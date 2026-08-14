// Regenerates data/sapporo/item-dictionary.json from the City of Sapporo's
// "家庭ごみ50音分別辞典" (household garbage 50-on sorting dictionary) page.
//
// Unlike the CKAN open dataset used by fetch-sapporo-calendar.mjs, this page
// is regular city-website content, not CC-BY licensed open data. It is
// reproduced here with the City of Sapporo's permission (see
// data/sapporo/source.json's itemDictionaryCreditText) rather than under an
// open license, so this script must not be reused for other municipalities'
// equivalent pages without separately confirming permission.
//
// The whole 50-on dictionary lives on a single HTML page (one <table> per
// kana heading), so this is a single fetch + regex-based table parse (no
// HTML-parser dependency needed; the markup is consistent goverment-CMS
// output). Run via `npm run fetch:sapporo-dict` whenever the page changes;
// there is no year-rollover concern here (unlike the collection calendar),
// so this does not need to run on the same weekly schedule as
// fetch-sapporo-calendar.mjs.

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data", "sapporo");

const sourcePath = path.join(dataDir, "source.json");
const source = JSON.parse(await readFile(sourcePath, "utf-8"));
const DICTIONARY_URL = source.sortingDictionaryUrl;

// City category label (品目 table's 分別区分 column) -> our internal
// categories.json id (+ subItem id, for the handful of labels that are
// really a sub-item of a broader category). Must be kept in sync with
// data/sapporo/categories.json; the script fails loudly below if the page
// ever contains a label this map doesn't know about.
const CATEGORY_MAP = {
  燃やせるごみ: { categoryId: "burnable" },
  燃やせないごみ: { categoryId: "non_burnable" },
  "びん・缶・ペットボトル": { categoryId: "bottles_cans_pet" },
  容器包装プラスチック: { categoryId: "plastic_containers" },
  雑がみ: { categoryId: "mixed_paper" },
  "枝・葉・草": { categoryId: "branches_leaves_grass" },
  大型ごみ: { categoryId: "bulky_waste" },
  "スプレー缶・カセットボンベ": { categoryId: "burnable", subItemId: "spray_can" },
  "加熱式たばこ・電子たばこ、ライター": { categoryId: "non_burnable", subItemId: "heated_tobacco_lighter" },
  筒型乾電池: { categoryId: "bottles_cans_pet", subItemId: "dry_batteries" },
};

// Labels that don't map to any collection-calendar category: the item isn't
// collected curbside at all, or its category depends on details covered
// only in the 備考 (notes) column.
const SPECIAL_MAP = {
  市で収集しないもの: "not_collected",
  "市で収集しないもの\n※ステーション収集はしていません": "not_collected",
  集団資源回収など: "community_recycling",
  "（備考欄参照）": "see_note",
};

function stripTags(html) {
  return html
    .replace(/<li[^>]*>/gi, "\n・")
    .replace(/<\/li>/gi, "")
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[a-z][^>]*>/gi, "") // any remaining tag (a, p, strong, span, ...)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

console.log(`Fetching ${DICTIONARY_URL} ...`);
const response = await fetch(DICTIONARY_URL);
if (!response.ok) {
  throw new Error(`Request failed (${response.status}): ${DICTIONARY_URL}`);
}
const html = await response.text();

// The page has one <h2><a id="...">かな</a></h2> per kana row, immediately
// followed by that row's <table>. Splitting on the h2 markers gives us one
// chunk per kana section to parse independently.
const sectionMarkerRe = /<h2><span class="txt_big"><a id="[a-z]+">([^<]+)<\/a><\/span><\/h2>/g;
const markers = [];
let markerMatch;
while ((markerMatch = sectionMarkerRe.exec(html))) {
  markers.push({ kana: markerMatch[1], index: markerMatch.index });
}
if (markers.length === 0) {
  throw new Error("Could not find any 50-on section headings — the page structure may have changed.");
}

const rawRows = [];
for (let i = 0; i < markers.length; i++) {
  const start = markers[i].index;
  const end = i + 1 < markers.length ? markers[i + 1].index : html.length;
  const chunk = html.slice(start, end);

  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  let rowMatch;
  while ((rowMatch = rowRe.exec(chunk))) {
    const rowHtml = rowMatch[1];
    if (/<th/i.test(rowHtml)) continue; // header row
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowHtml))) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length !== 4) {
      throw new Error(
        `Expected 4 columns (品目/分別区分/手数料/備考) but found ${cells.length} in kana section "${markers[i].kana}": ${rowHtml.slice(0, 200)}`,
      );
    }
    rawRows.push({ name: cells[0], categoryLabel: cells[1], fee: cells[2], note: cells[3] });
  }
}

const unmappedLabels = new Set();
const items = rawRows.map(({ name, categoryLabel, fee, note }) => {
  const mapped = CATEGORY_MAP[categoryLabel];
  const special = SPECIAL_MAP[categoryLabel];
  if (!mapped && !special) unmappedLabels.add(categoryLabel);
  return {
    name,
    categoryId: mapped?.categoryId ?? null,
    subItemId: mapped?.subItemId ?? null,
    special: special ?? null,
    fee: fee && fee !== "-" ? fee : null,
    note: note || null,
  };
});

if (unmappedLabels.size > 0) {
  throw new Error(
    `Found 分別区分 label(s) not present in CATEGORY_MAP/SPECIAL_MAP: ${[...unmappedLabels].join(", ")}. ` +
      "Update scripts/fetch-sapporo-item-dictionary.mjs (and data/sapporo/categories.json if it's a new category) before re-running.",
  );
}

const itemDictionary = {
  municipalityCode: "sapporo",
  sourceUrl: DICTIONARY_URL,
  items,
};

await writeFile(
  path.join(dataDir, "item-dictionary.json"),
  `${JSON.stringify(itemDictionary, null, 2)}\n`,
  "utf-8",
);
console.log(`Wrote ${items.length} items to data/sapporo/item-dictionary.json`);

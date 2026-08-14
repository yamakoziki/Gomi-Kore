// Regenerates data/otaru/item-dictionary.json from the City of Otaru's
// official 分別区早見表 CSV (bunbetsu_hayamihyo2.csv: 五十音, 品目, 分別, 摘要),
// linked from data/otaru/source.json's itemDictionaryCsvUrl. This is the same
// underlying data that data/otaru/categories.json's per-category `keywords`
// lists were built from, but this script also keeps the CSV's 摘要 (remarks)
// column and produces a structured item -> category lookup (ItemDictionaryData)
// usable by src/logic/itemSearch.ts's searchItemDictionary() — the same shape
// as Sapporo's item-dictionary.json. Once a municipality has its own
// itemDictionaryData, src/adapters/registry.ts's getReferenceItemDictionary()
// stops surfacing another municipality's dictionary as a fallback reference
// for it.
//
// Must run in Node (not the browser): city.otaru.lg.jp does not send
// Access-Control-Allow-Origin, so a browser-side fetch() is blocked by CORS
// (same constraint as fetch-otaru-calendar.mjs). Run via
// `npm run fetch:otaru-dict` whenever this CSV changes.

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data", "otaru");

const source = JSON.parse(await readFile(path.join(dataDir, "source.json"), "utf-8"));
const categoriesData = JSON.parse(await readFile(path.join(dataDir, "categories.json"), "utf-8"));

if (!source.itemDictionaryCsvUrl) {
  throw new Error("data/otaru/source.json is missing itemDictionaryCsvUrl");
}

// CSV 分別 column -> categories.json id.
const CATEGORY_MAP = {
  燃やすごみ: "burnable",
  燃やさないごみ: "non_burnable",
  "資源物(かん等)": "cans_bottles_etc",
  "資源物(紙類)": "paper",
  "資源物(プラ類)": "plastic",
  "収集しないごみ(粗大ごみ)": "bulky_waste",
  "収集しないごみ(家電4品目)": "appliance_recycling_law",
  小型家電製品: "small_appliances",
};
// "収集しないごみ" alone is ambiguous in the CSV — it covers both the general
// not-collected bucket and PC/monitor items (the CSV's only remark for those
// is "P32参照", i.e. "see page 32" of the city's paper pamphlet, which means
// nothing outside that pamphlet). Disambiguated by checking against
// pc_recycling's own keywords list, itself built from this exact same CSV.
const NOT_COLLECTED_LABEL = "収集しないごみ";
const NOT_COLLECTED_FALLBACK_ID = "not_collected_other";
const PC_RECYCLING_ID = "pc_recycling";
const pcRecyclingKeywords = new Set(categoriesData.categories.find((c) => c.id === PC_RECYCLING_ID)?.keywords ?? []);

// Minimal RFC4180-ish CSV parser (no external dependency), same as fetch-otaru-calendar.mjs.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

console.log(`Fetching ${source.itemDictionaryCsvUrl} ...`);
const response = await fetch(source.itemDictionaryCsvUrl);
if (!response.ok) {
  throw new Error(`Request failed (${response.status}): ${source.itemDictionaryCsvUrl}`);
}
const buffer = await response.arrayBuffer();
const csvText = new TextDecoder("shift_jis").decode(buffer);
const rows = parseCsv(csvText);

const [header, ...dataRows] = rows;
if (header.join(",") !== "五十音,品目,分別,摘要") {
  throw new Error(`Unexpected CSV header (${header.join(",")}) — the file format may have changed.`);
}

const unmappedLabels = new Set();
const items = dataRows.map((row) => {
  if (row.length !== 4) {
    throw new Error(`Expected 4 columns (五十音/品目/分別/摘要) but found ${row.length}: ${JSON.stringify(row)}`);
  }
  const [, name, label, remark] = row;

  let categoryId = CATEGORY_MAP[label] ?? null;
  if (!categoryId && label === NOT_COLLECTED_LABEL) {
    categoryId = pcRecyclingKeywords.has(name) ? PC_RECYCLING_ID : NOT_COLLECTED_FALLBACK_ID;
  }
  if (!categoryId) unmappedLabels.add(label);

  const trimmedRemark = remark.trim();
  // Once resolved to pc_recycling, "see page 32 [of the paper pamphlet]" adds nothing —
  // categories.json's own feeNote/contact for pc_recycling already covers it.
  const isRedundantPageReference = categoryId === PC_RECYCLING_ID && trimmedRemark === "P32参照";

  return {
    name,
    categoryId,
    subItemId: null,
    special: null,
    fee: null,
    note: trimmedRemark && !isRedundantPageReference ? trimmedRemark : null,
  };
});

if (unmappedLabels.size > 0) {
  throw new Error(
    `Found 分別 label(s) not present in CATEGORY_MAP: ${[...unmappedLabels].join(", ")}. ` +
      "Update scripts/fetch-otaru-item-dictionary.mjs (and data/otaru/categories.json if it's a new category) before re-running.",
  );
}

const knownCategoryIds = new Set(categoriesData.categories.map((c) => c.id));
const unknownCategoryIds = [...new Set(items.map((i) => i.categoryId))].filter((id) => !knownCategoryIds.has(id));
if (unknownCategoryIds.length > 0) {
  throw new Error(
    `Mapped to categoryId(s) not present in data/otaru/categories.json: ${unknownCategoryIds.join(", ")}`,
  );
}

const itemDictionary = {
  municipalityCode: "otaru",
  sourceUrl: source.itemDictionaryCsvUrl,
  items,
};

await writeFile(path.join(dataDir, "item-dictionary.json"), `${JSON.stringify(itemDictionary, null, 2)}\n`, "utf-8");
console.log(`Wrote ${items.length} items to data/otaru/item-dictionary.json`);

// Regenerates data/sapporo/calendar.json (and refreshes the resource IDs in
// data/sapporo/source.json) from the live CKAN API.
//
// Must run in Node (not the browser): ckan.pf-sapporo.jp does not send
// Access-Control-Allow-Origin, so a browser-side fetch() is blocked by CORS
// even though the API itself works fine (verified with curl).
//
// The calendar's resource_id changes every fiscal year (the resource is
// literally replaced, not updated in place), so instead of hardcoding it we
// look it up each run via CKAN's package_show, matching resources by name
// ("収集日カレンダー" / "ごみ種別"). Run this via `npm run fetch:sapporo`
// whenever the data needs refreshing; the scheduled GitHub Action
// (.github/workflows/refresh-calendar.yml) does this weekly and commits any
// changes automatically.

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data", "sapporo");

const sourcePath = path.join(dataDir, "source.json");
const source = JSON.parse(await readFile(sourcePath, "utf-8"));
const areaMapping = JSON.parse(await readFile(path.join(dataDir, "area-mapping.json"), "utf-8"));
const categoriesData = JSON.parse(await readFile(path.join(dataDir, "categories.json"), "utf-8"));

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }
  return response.json();
}

function parseDateRangeFromName(name) {
  const match = name.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*[～~-]\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  const [, y1, m1, d1, y2, m2, d2] = match;
  const pad = (n) => String(n).padStart(2, "0");
  return {
    start: `${y1}-${pad(m1)}-${pad(d1)}`,
    end: `${y2}-${pad(m2)}-${pad(d2)}`,
  };
}

console.log(`Looking up current resources for dataset "${source.datasetSlug}"...`);
const packageUrl = new URL(source.packageShowUrl);
packageUrl.searchParams.set("id", source.datasetSlug);
const packageJson = await fetchJson(packageUrl);
if (!packageJson.success) {
  throw new Error("package_show returned success=false");
}
const resources = packageJson.result.resources;

const calendarResources = resources.filter((r) => (r.name ?? "").includes("収集日カレンダー"));
if (calendarResources.length === 0) {
  throw new Error('No resource with "収集日カレンダー" in its name was found — the dataset structure may have changed.');
}

const today = new Date().toISOString().slice(0, 10);
const withRanges = calendarResources.map((r) => ({ resource: r, range: parseDateRangeFromName(r.name ?? "") }));
const current = withRanges.find(({ range }) => range && range.start <= today && today <= range.end);
const chosen = (current ?? withRanges.sort((a, b) => (b.resource.last_modified ?? "").localeCompare(a.resource.last_modified ?? ""))[0])
  .resource;

const categoryTableResource = resources.find((r) => (r.name ?? "").includes("ごみ種別"));

const calendarResourceId = chosen.id;
console.log(`Using calendar resource: ${chosen.name} (${calendarResourceId})`);

const url = new URL(source.apiBaseUrl);
url.searchParams.set("resource_id", calendarResourceId);
url.searchParams.set("limit", "400");
const json = await fetchJson(url);
if (!json.success) {
  throw new Error("Sapporo calendar API returned success=false");
}

const areaColumnNames = areaMapping.areas.map((area) => area.columnName);
const knownCodes = new Set(categoriesData.categories.map((c) => c.code).filter(Boolean));
const unknownCodes = new Set();

const days = json.result.records
  .map((record) => {
    const areas = {};
    for (const columnName of areaColumnNames) {
      const raw = record[columnName];
      const code = raw === null || raw === undefined ? null : String(raw);
      if (code && !knownCodes.has(code)) unknownCodes.add(code);
      areas[columnName] = code;
    }
    return {
      date: String(record["日付"]).slice(0, 10),
      weekday: String(record["曜"]),
      areas,
    };
  })
  .sort((a, b) => a.date.localeCompare(b.date));

if (unknownCodes.size > 0) {
  console.warn(
    `WARNING: calendar contains collection code(s) not present in categories.json: ${[...unknownCodes].join(", ")}. ` +
      "categories.json may need a manual update (see data/sapporo/categories.json).",
  );
}

const periodStart = days[0]?.date ?? source.calendarPeriod.start;
const periodEnd = days[days.length - 1]?.date ?? source.calendarPeriod.end;

const calendar = {
  municipalityCode: "sapporo",
  periodStart,
  periodEnd,
  days,
  fetchedAt: new Date().toISOString(),
};

await writeFile(path.join(dataDir, "calendar.json"), `${JSON.stringify(calendar, null, 2)}\n`, "utf-8");
console.log(`Wrote ${days.length} days (${periodStart} to ${periodEnd}) to data/sapporo/calendar.json`);

const updatedSource = {
  ...source,
  categoryTableResourceId: categoryTableResource?.id ?? source.categoryTableResourceId,
  calendarResourceId,
  calendarPeriod: { start: periodStart, end: periodEnd },
  lastVerifiedAt: today,
};
await writeFile(sourcePath, `${JSON.stringify(updatedSource, null, 2)}\n`, "utf-8");
console.log("Updated data/sapporo/source.json");

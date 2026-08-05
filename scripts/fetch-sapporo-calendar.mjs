// Regenerates data/sapporo/calendar.json from the live CKAN API.
//
// This must run in Node (not the browser): ckan.pf-sapporo.jp does not send
// Access-Control-Allow-Origin, so a browser-side fetch() is blocked by CORS
// even though the API itself works fine (verified with curl). Re-run this
// script whenever the calendar resource_id changes (new fiscal year) or the
// data needs refreshing, then commit the updated JSON.

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data", "sapporo");

const source = JSON.parse(await readFile(path.join(dataDir, "source.json"), "utf-8"));
const areaMapping = JSON.parse(await readFile(path.join(dataDir, "area-mapping.json"), "utf-8"));

const url = new URL(source.apiBaseUrl);
url.searchParams.set("resource_id", source.calendarResourceId);
url.searchParams.set("limit", "400");

const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Sapporo calendar API request failed: ${response.status}`);
}
const json = await response.json();
if (!json.success) {
  throw new Error("Sapporo calendar API returned success=false");
}

const areaColumnNames = areaMapping.areas.map((area) => area.columnName);

const days = json.result.records
  .map((record) => {
    const areas = {};
    for (const columnName of areaColumnNames) {
      const raw = record[columnName];
      areas[columnName] = raw === null || raw === undefined ? null : String(raw);
    }
    return {
      date: String(record["日付"]).slice(0, 10),
      weekday: String(record["曜"]),
      areas,
    };
  })
  .sort((a, b) => a.date.localeCompare(b.date));

const calendar = {
  municipalityCode: "sapporo",
  periodStart: source.calendarPeriod.start,
  periodEnd: source.calendarPeriod.end,
  days,
  fetchedAt: new Date().toISOString(),
};

const outPath = path.join(dataDir, "calendar.json");
await writeFile(outPath, `${JSON.stringify(calendar, null, 2)}\n`, "utf-8");
console.log(`Wrote ${days.length} days to ${outPath}`);

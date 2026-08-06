// Regenerates data/otaru/calendar.json from the CSV files the city of Otaru
// publishes at data/otaru/source.json's csvIndexUrl.
//
// Must run in Node (not the browser): city.otaru.lg.jp does not send
// Access-Control-Allow-Origin, so a browser-side fetch() is blocked by CORS
// even though the files themselves are public (verified with curl).
//
// The calendar file name changes every calendar year (e.g. 2026gomicalendar.csv
// -> 2027gomicalendar.csv), so instead of hardcoding it we scrape the current
// link off the index page each run. The files are Shift-JIS encoded, not
// UTF-8. Run this via `npm run fetch:otaru` whenever the data needs
// refreshing; .github/workflows/refresh-otaru-calendar.yml does this weekly
// and commits any changes automatically.

import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data", "otaru");

const sourcePath = path.join(dataDir, "source.json");
const source = JSON.parse(await readFile(sourcePath, "utf-8"));
const categoriesData = JSON.parse(await readFile(path.join(dataDir, "categories.json"), "utf-8"));

async function fetchSjisText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }
  const buffer = await response.arrayBuffer();
  return new TextDecoder("shift_jis").decode(buffer);
}

// Minimal RFC4180-ish CSV parser (no external dependency). Handles quoted
// fields, including embedded commas/newlines/escaped quotes, which the
// city's sorting-dictionary CSV uses (not needed for the calendar CSV
// itself, but shared here in case a future script reuses it).
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

function normalizeDate(raw) {
  // "2026/1/1" -> "2026-01-01"
  const [y, m, d] = raw.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizeCode(raw) {
  // Cells use full-width spaces inside category names ("可　燃") and
  // whitespace-only cells (half/full-width) to mean "no collection".
  const stripped = (raw ?? "").replace(/[\s　]+/g, "");
  return stripped.length > 0 ? stripped : null;
}

console.log(`Looking up current calendar CSV link from ${source.csvIndexUrl} ...`);
const indexHtml = await (await fetch(source.csvIndexUrl)).text();
const match = indexHtml.match(/file_contents\/(\d{4}gomicalendar\.csv)/);
if (!match) {
  throw new Error(
    "Could not find a {year}gomicalendar.csv link on the index page — the page structure may have changed.",
  );
}
const calendarFileName = match[1];
const calendarCsvUrl = `${source.csvIndexUrl}/file_contents/${calendarFileName}`;
console.log(`Using calendar CSV: ${calendarCsvUrl}`);

const csvText = await fetchSjisText(calendarCsvUrl);
const rows = parseCsv(csvText);
const header = rows[0];
const areaColumnNames = header.slice(2);

const knownCodes = new Set(categoriesData.categories.map((c) => c.code).filter(Boolean));
const unknownCodes = new Set();

const days = rows
  .slice(1)
  .map((row) => {
    const areas = {};
    areaColumnNames.forEach((columnName, i) => {
      const code = normalizeCode(row[2 + i]);
      if (code && !knownCodes.has(code)) unknownCodes.add(code);
      areas[columnName] = code;
    });
    return {
      date: normalizeDate(row[0]),
      weekday: row[1],
      areas,
    };
  })
  .sort((a, b) => a.date.localeCompare(b.date));

if (unknownCodes.size > 0) {
  console.warn(
    `WARNING: calendar contains collection code(s) not present in categories.json: ${[...unknownCodes].join(", ")}. ` +
      "categories.json may need a manual update (see data/otaru/categories.json).",
  );
}

const periodStart = days[0]?.date ?? source.calendarPeriod.start;
const periodEnd = days[days.length - 1]?.date ?? source.calendarPeriod.end;

const calendar = {
  municipalityCode: "otaru",
  periodStart,
  periodEnd,
  days,
  fetchedAt: new Date().toISOString(),
};

await writeFile(path.join(dataDir, "calendar.json"), `${JSON.stringify(calendar, null, 2)}\n`, "utf-8");
console.log(`Wrote ${days.length} days (${periodStart} to ${periodEnd}) to data/otaru/calendar.json`);

const today = new Date().toISOString().slice(0, 10);
const updatedSource = {
  ...source,
  calendarCsvUrl,
  calendarPeriod: { start: periodStart, end: periodEnd },
  lastVerifiedAt: today,
};
await writeFile(sourcePath, `${JSON.stringify(updatedSource, null, 2)}\n`, "utf-8");
console.log("Updated data/otaru/source.json");

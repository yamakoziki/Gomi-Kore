import { describe, expect, it } from "vitest";
import type { CalendarData, CategoriesData } from "../types";
import {
  getCategoriesForDate,
  getCollectionCodeForDate,
  getNextCollectionDate,
  resolveCategoryByCode,
} from "./collection";
import { toDateKey } from "./date";

const AREA = "中央区1";

const calendar: CalendarData = {
  municipalityCode: "sapporo",
  periodStart: "2026-08-01",
  periodEnd: "2026-08-10",
  fetchedAt: "2026-08-01T00:00:00Z",
  days: [
    { date: "2026-08-05", weekday: "水", areas: { [AREA]: "1" } },
    { date: "2026-08-06", weekday: "木", areas: { [AREA]: null } },
    { date: "2026-08-07", weekday: "金", areas: { [AREA]: "9" } },
    { date: "2026-08-08", weekday: "土", areas: { [AREA]: null } },
    { date: "2026-08-09", weekday: "日", areas: { [AREA]: null } },
    { date: "2026-08-10", weekday: "月", areas: { [AREA]: "1" } },
  ],
};

const categoriesData: CategoriesData = {
  municipalityCode: "sapporo",
  noCollection: { code: "", label: { ja: "収集なし" } },
  categories: [
    {
      code: "1",
      id: "burnable",
      name: { ja: "燃やせるごみ" },
      scheduleType: "regular",
      feeType: "designated_bag",
    },
    {
      code: "9",
      id: "plastic_containers",
      name: { ja: "容器包装プラスチック" },
      scheduleType: "regular",
      feeType: "free",
    },
  ],
};

describe("getCollectionCodeForDate", () => {
  it("returns the code for a date with collection", () => {
    expect(getCollectionCodeForDate(calendar, AREA, new Date(2026, 7, 5))).toBe("1");
  });

  it("returns null for a date with no collection", () => {
    expect(getCollectionCodeForDate(calendar, AREA, new Date(2026, 7, 6))).toBeNull();
  });

  it("returns null for a date missing from the calendar entirely", () => {
    expect(getCollectionCodeForDate(calendar, AREA, new Date(2026, 7, 20))).toBeNull();
  });
});

describe("resolveCategoryByCode / getCategoriesForDate", () => {
  it("resolves a known code to its category", () => {
    expect(resolveCategoryByCode(categoriesData, "9")?.id).toBe("plastic_containers");
  });

  it("returns an empty list when there is no collection that day", () => {
    expect(getCategoriesForDate(calendar, categoriesData, AREA, new Date(2026, 7, 8))).toEqual([]);
  });

  it("returns the matching category when there is a collection", () => {
    const categories = getCategoriesForDate(calendar, categoriesData, AREA, new Date(2026, 7, 7));
    expect(categories).toHaveLength(1);
    expect(categories[0].id).toBe("plastic_containers");
  });
});

describe("getNextCollectionDate", () => {
  it("finds the same day if it matches", () => {
    const result = getNextCollectionDate(calendar, AREA, "1", new Date(2026, 7, 5));
    expect(result && toDateKey(result)).toBe("2026-08-05");
  });

  it("skips gap days with no collection and lands on the next match", () => {
    const result = getNextCollectionDate(calendar, AREA, "1", new Date(2026, 7, 6));
    expect(result && toDateKey(result)).toBe("2026-08-10");
  });

  it("returns null when no match exists within the search window", () => {
    const result = getNextCollectionDate(calendar, AREA, "99", new Date(2026, 7, 5), 6);
    expect(result).toBeNull();
  });
});

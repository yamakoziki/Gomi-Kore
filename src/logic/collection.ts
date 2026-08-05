import type { CalendarData, CalendarDay, Category, CategoriesData } from "../types";
import { addDays, toDateKey } from "./date";

export function findCalendarDay(calendar: CalendarData, date: Date): CalendarDay | undefined {
  const key = toDateKey(date);
  return calendar.days.find((day) => day.date === key);
}

export function getCollectionCodeForDate(
  calendar: CalendarData,
  areaColumnName: string,
  date: Date,
): string | null {
  const day = findCalendarDay(calendar, date);
  if (!day) return null;
  const code = day.areas[areaColumnName];
  return code ? code : null;
}

/**
 * Codes not present in categories.json are treated the same as "no
 * collection" rather than thrown/crashed on. This matters in practice: the
 * live Sapporo data contains at least one undocumented code ("0", seen
 * scattered on winter dates, absent from the official code table) that
 * fetch-sapporo-calendar.mjs warns about on every run but can't safely
 * auto-map without knowing what it actually means.
 */
export function resolveCategoryByCode(
  categoriesData: CategoriesData,
  code: string | null,
): Category | undefined {
  if (!code) return undefined;
  return categoriesData.categories.find((category) => category.code === code);
}

export function getCategoriesForDate(
  calendar: CalendarData,
  categoriesData: CategoriesData,
  areaColumnName: string,
  date: Date,
): Category[] {
  const code = getCollectionCodeForDate(calendar, areaColumnName, date);
  const category = resolveCategoryByCode(categoriesData, code);
  return category ? [category] : [];
}

/**
 * Finds the next date (searching forward from `fromDate`, inclusive) on which
 * the given area has a collection matching `categoryCode`. Only meaningful
 * for "regular" schedule categories that appear on the calendar.
 */
export function getNextCollectionDate(
  calendar: CalendarData,
  areaColumnName: string,
  categoryCode: string,
  fromDate: Date,
  maxDaysToSearch = 400,
): Date | null {
  for (let offset = 0; offset < maxDaysToSearch; offset++) {
    const candidate = addDays(fromDate, offset);
    const code = getCollectionCodeForDate(calendar, areaColumnName, candidate);
    if (code === categoryCode) {
      return candidate;
    }
  }
  return null;
}

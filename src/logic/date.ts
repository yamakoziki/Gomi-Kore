/**
 * Collection runs start early in the morning, so before this hour "today"
 * still refers to today's collection; from this hour onward the app should
 * point users at tomorrow's collection instead.
 */
export const COLLECTION_CUTOFF_HOUR = 8;

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export type TargetDay = "today" | "tomorrow";

/**
 * Determines which day's collection info should be shown right now.
 * 0:00-07:59 -> today, 8:00-23:59 -> tomorrow.
 */
export function getTargetDay(now: Date, cutoffHour: number = COLLECTION_CUTOFF_HOUR): TargetDay {
  return now.getHours() < cutoffHour ? "today" : "tomorrow";
}

export function getTargetDate(now: Date, cutoffHour: number = COLLECTION_CUTOFF_HOUR): Date {
  return getTargetDay(now, cutoffHour) === "today" ? now : addDays(now, 1);
}

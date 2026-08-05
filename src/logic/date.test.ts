import { describe, expect, it } from "vitest";
import { addDays, getTargetDate, getTargetDay, toDateKey } from "./date";

describe("getTargetDay", () => {
  it("returns today just before the cutoff hour", () => {
    const now = new Date(2026, 7, 5, 7, 59);
    expect(getTargetDay(now)).toBe("today");
  });

  it("returns tomorrow exactly at the cutoff hour", () => {
    const now = new Date(2026, 7, 5, 8, 0);
    expect(getTargetDay(now)).toBe("tomorrow");
  });

  it("returns today at midnight", () => {
    const now = new Date(2026, 7, 5, 0, 0);
    expect(getTargetDay(now)).toBe("today");
  });

  it("returns tomorrow late at night", () => {
    const now = new Date(2026, 7, 5, 23, 59);
    expect(getTargetDay(now)).toBe("tomorrow");
  });

  it("respects a custom cutoff hour", () => {
    const now = new Date(2026, 7, 5, 6, 0);
    expect(getTargetDay(now, 5)).toBe("tomorrow");
    expect(getTargetDay(now, 7)).toBe("today");
  });
});

describe("getTargetDate", () => {
  it("advances to the next calendar day when past the cutoff, including month/year rollover", () => {
    const now = new Date(2025, 11, 31, 9, 0); // 2025-12-31 09:00
    const target = getTargetDate(now);
    expect(toDateKey(target)).toBe("2026-01-01");
  });
});

describe("addDays", () => {
  it("rolls over month boundaries", () => {
    const result = addDays(new Date(2026, 0, 31), 1);
    expect(toDateKey(result)).toBe("2026-02-01");
  });
});

describe("toDateKey", () => {
  it("zero-pads month and day", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

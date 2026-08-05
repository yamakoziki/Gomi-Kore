import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNow } from "./useNow";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 5, 7, 59, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNow", () => {
  it("returns the current time and updates as time passes without any other interaction", () => {
    const { result } = renderHook(() => useNow(60_000));
    expect(result.current.getHours()).toBe(7);
    expect(result.current.getMinutes()).toBe(59);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current.getHours()).toBe(8);
    expect(result.current.getMinutes()).toBe(0);
  });
});

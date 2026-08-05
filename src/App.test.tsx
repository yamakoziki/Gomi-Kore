import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const AREA = "中央区1";

function mockCkanResponse() {
  const records = [
    { 日付: "2026-08-05T00:00:00", 曜: "水", [AREA]: 1 },
    { 日付: "2026-08-06T00:00:00", 曜: "木", [AREA]: 9 },
    { 日付: "2026-08-07T00:00:00", 曜: "金", [AREA]: null },
  ];
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, result: { records, total: records.length } }),
  } as Response;
}

beforeEach(() => {
  vi.setSystemTime(new Date(2026, 7, 5, 10, 0)); // 2026-08-05 10:00 -> past cutoff -> shows tomorrow (8/6)
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockCkanResponse()));

  class FakeUtterance {
    lang = "";
    text: string;
    constructor(text: string) {
      this.text = text;
    }
  }
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });

  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("App", () => {
  it("loads the calendar, lets the user pick an area, and shows tomorrow's collection", async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    expect(await screen.findByText(/上の欄からお住まいの地区を選択してください/)).toBeInTheDocument();

    const select = screen.getByLabelText("お住まいの地区を選択してください");
    await user.selectOptions(select, AREA);

    const heading = await screen.findByText("明日（8/6）のごみ");
    const todayPanel = heading.closest("section") as HTMLElement;
    expect(within(todayPanel).getByText("容器包装プラスチック")).toBeInTheDocument();
    expect(within(todayPanel).getByText("無料")).toBeInTheDocument();
  });

  it("shows the next collection date and contact info when tapping category cards", async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    const select = await screen.findByLabelText("お住まいの地区を選択してください");
    await user.selectOptions(select, AREA);
    const allCategoriesHeading = await screen.findByText("品目から調べる");
    const allCategoriesPanel = allCategoriesHeading.closest("section") as HTMLElement;

    await user.click(within(allCategoriesPanel).getByText("容器包装プラスチック"));
    expect(await within(allCategoriesPanel).findByText(/次回収集日: 8\/6/)).toBeInTheDocument();

    await user.click(within(allCategoriesPanel).getByText("大型ごみ（粗大ごみ）"));
    expect(await within(allCategoriesPanel).findByText(/事前申込が必要です/)).toBeInTheDocument();
    expect(within(allCategoriesPanel).getByText(/011-281-8153/)).toBeInTheDocument();
  });

  it("reads today's collection aloud via speech synthesis", async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    const select = await screen.findByLabelText("お住まいの地区を選択してください");
    await user.selectOptions(select, AREA);
    await screen.findByText("🔊 読み上げる");

    await user.click(screen.getByText("🔊 読み上げる"));

    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    const utterance = (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(utterance.text).toContain("容器包装プラスチック");
  });

  it("falls back to a cached calendar and shows an offline notice when the network fails", async () => {
    localStorage.setItem(
      "gomi-kore:sapporo:calendar",
      JSON.stringify({
        municipalityCode: "sapporo",
        periodStart: "2026-08-01",
        periodEnd: "2026-08-10",
        fetchedAt: "2026-08-04T09:00:00.000Z",
        days: [{ date: "2026-08-06", weekday: "木", areas: { [AREA]: "10" } }],
      }),
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const user = userEvent.setup({ delay: null });
    render(<App />);

    const select = await screen.findByLabelText("お住まいの地区を選択してください");
    await user.selectOptions(select, AREA);

    expect(await screen.findByText(/保存済みデータを表示中/)).toBeInTheDocument();
    const heading = screen.getByText("明日（8/6）のごみ");
    const todayPanel = heading.closest("section") as HTMLElement;
    expect(within(todayPanel).getByText("雑がみ")).toBeInTheDocument();
  });
});

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import i18n from "./i18n";

const AREA = "中央区1";
const WARD = "中央区";
const SUB_AREA_NUMBER = "1";

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

async function selectArea(user: UserEvent, wardLabel = "お住まいの区", districtLabel = "地区番号") {
  await user.selectOptions(await screen.findByLabelText(wardLabel), WARD);
  await user.selectOptions(await screen.findByLabelText(districtLabel), SUB_AREA_NUMBER);
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
  localStorage.setItem("gomi-kore:municipalityCode", JSON.stringify("sapporo"));
  void i18n.changeLanguage("ja");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("App", () => {
  it("loads the calendar, lets the user pick a ward and district, and shows tomorrow's collection", async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    expect(await screen.findByText(/上の欄からお住まいの地区を選択してください/)).toBeInTheDocument();

    await selectArea(user);

    const heading = await screen.findByText("明日（8/6）のごみ");
    const todayPanel = heading.closest("section") as HTMLElement;
    expect(within(todayPanel).getByText("容器包装プラスチック")).toBeInTheDocument();
    expect(within(todayPanel).getByText("無料")).toBeInTheDocument();
  });

  it("shows the next collection date and contact info when tapping category cards", async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    await selectArea(user);
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

    await selectArea(user);
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

    await selectArea(user);

    expect(await screen.findByText(/保存済みデータを表示中/)).toBeInTheDocument();
    const heading = screen.getByText("明日（8/6）のごみ");
    const todayPanel = heading.closest("section") as HTMLElement;
    expect(within(todayPanel).getByText("雑がみ")).toBeInTheDocument();
  });

  it("switches the UI and speech language to English when selected", async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    await selectArea(user);
    await screen.findByText("🔊 読み上げる");

    await user.selectOptions(screen.getByLabelText("言語"), "en");

    const heading = await screen.findByText("Tomorrow's garbage (8/6)");
    const todayPanel = heading.closest("section") as HTMLElement;
    expect(within(todayPanel).getByText("Plastic containers & packaging")).toBeInTheDocument();
    expect(within(todayPanel).getByText("Free")).toBeInTheDocument();

    await user.click(within(todayPanel).getByText("🔊 Read aloud"));
    const utterance = (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(utterance.lang).toBe("en-US");
    expect(utterance.text).toContain("Plastic containers & packaging");
  });

  it("finds a category by an English keyword in the item search when the UI language is English", async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    await selectArea(user);
    await user.selectOptions(screen.getByLabelText("言語"), "en");

    const heading = await screen.findByText("What bin does this go in?");
    const panel = heading.closest("section") as HTMLElement;

    // The 50-on item dictionary is Japanese-only and disabled in English mode; this only works
    // because categories.json's own keywords now carry English synonyms too (see spray_can subItem).
    await user.type(within(panel).getByPlaceholderText("e.g. spray can"), "spray can");
    await user.click(within(panel).getByText("Search"));

    expect(await within(panel).findByText("Burnable garbage")).toBeInTheDocument();
  });

  it("auto-detects the ward from geolocation and leaves the district for manual selection", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 43.0618, longitude: 141.3545 } as GeolocationCoordinates,
      } as GeolocationPosition);
    });
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL) => {
        const href = String(url);
        if (href.includes("mreversegeocoder.gsi.go.jp")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ results: { muniCd: "01101", lv01Nm: "北一条西二丁目" } }),
          } as Response);
        }
        return Promise.resolve(mockCkanResponse());
      }),
    );

    const user = userEvent.setup({ delay: null });
    render(<App />);

    await user.click(await screen.findByText("📍 現在地から区を自動判定"));

    expect(await screen.findByText("中央区を検出しました。地区番号を選択してください。")).toBeInTheDocument();
    expect(screen.getByLabelText("お住まいの区")).toHaveValue(WARD);

    await user.selectOptions(screen.getByLabelText("地区番号"), SUB_AREA_NUMBER);
    expect(await screen.findByText("明日（8/6）のごみ")).toBeInTheDocument();
  });

  it("finds a category by item name in the item search and reads the answer aloud", async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    await selectArea(user);
    const heading = await screen.findByText("これ何ゴミ？");
    const panel = heading.closest("section") as HTMLElement;

    await user.type(within(panel).getByPlaceholderText("例: スプレー缶"), "スプレー缶");
    await user.click(within(panel).getByText("検索"));

    expect(await within(panel).findByText("燃やせるごみ")).toBeInTheDocument();
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    const utterance = (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(utterance.text).toContain("スプレー缶");
    expect(utterance.text).toContain("スプレー缶類");
  });

  it("shows a link to the official sorting dictionary when an item isn't found", async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    await selectArea(user);
    const heading = await screen.findByText("これ何ゴミ？");
    const panel = heading.closest("section") as HTMLElement;

    await user.type(within(panel).getByPlaceholderText("例: スプレー缶"), "ザザザ存在しない品目ザザザ");
    await user.click(within(panel).getByText("検索"));

    expect(
      await within(panel).findByText("「ザザザ存在しない品目ザザザ」は見つかりませんでした。"),
    ).toBeInTheDocument();
    const link = within(panel).getByText("札幌市公式の「家庭ごみ50音分別辞典」で調べる");
    expect(link).toHaveAttribute("href", "https://www.city.sapporo.jp/seiso/bunbetsu/index.html");
  });

  it("looks up an item in the full 50-on sorting dictionary and reads out the answer, even for items not covered by categories.json's own keyword list", async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    await selectArea(user);
    const heading = await screen.findByText("これ何ゴミ？");
    const panel = heading.closest("section") as HTMLElement;

    // "ピアノ" isn't a curbside category at all (city site: 市で収集しないもの) — categories.json's
    // hand-curated keyword list has no entry for it, only the full sorting dictionary does.
    await user.type(within(panel).getByPlaceholderText("例: スプレー缶"), "ピアノ");
    await user.click(within(panel).getByText("検索"));

    expect(await within(panel).findByText("札幌市では収集していません")).toBeInTheDocument();
    expect(within(panel).getByText("販売店に相談")).toBeInTheDocument();
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    const utterance = (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(utterance.text).toContain("ピアノ");
    expect(utterance.text).toContain("札幌市では収集していません");
  });

  it("shows a manual-selection message when location access is denied", async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });

    const user = userEvent.setup({ delay: null });
    render(<App />);

    await user.click(await screen.findByText("📍 現在地から区を自動判定"));

    expect(await screen.findByText("位置情報の利用が許可されていません。区を手動で選択してください。")).toBeInTheDocument();
  });

  it("migrates a pre-existing Sapporo-only area selection to the new municipality-aware storage", async () => {
    localStorage.clear();
    localStorage.setItem("gomi-kore:sapporo:areaCode", JSON.stringify(AREA));

    render(<App />);

    // No municipality picker shown — the legacy Sapporo selection is honored automatically,
    // and the previously selected area is carried straight through to the calendar.
    expect(screen.queryByText("お住まいの自治体を選択してください。")).not.toBeInTheDocument();
    const heading = await screen.findByText("明日（8/6）のごみ");
    const todayPanel = heading.closest("section") as HTMLElement;
    expect(within(todayPanel).getByText("容器包装プラスチック")).toBeInTheDocument();
  });

  it("lets a first-time visitor pick Otaru and shows its collection calendar", async () => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down"))); // forces the bundled Otaru snapshot

    const user = userEvent.setup({ delay: null });
    render(<App />);

    expect(await screen.findByText("お住まいの自治体を選択してください。")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("自治体"), "otaru");

    expect(await screen.findByText(/今日のゴミ、聞かなくても分かる。（小樽市版）/)).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText("お住まいの地区（町名）"), "相生町");

    const heading = await screen.findByText("明日（8/6）のごみ");
    const todayPanel = heading.closest("section") as HTMLElement;
    expect(within(todayPanel).getByText("燃やすごみ")).toBeInTheDocument();
  });

  it("uses Otaru's own structured item dictionary (with per-item remarks) and shows no Sapporo reference block, now that Otaru has its own", async () => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down"))); // forces the bundled Otaru snapshot

    const user = userEvent.setup({ delay: null });
    render(<App />);

    await user.selectOptions(await screen.findByLabelText("自治体"), "otaru");
    await user.selectOptions(await screen.findByLabelText("お住まいの地区（町名）"), "相生町");

    const heading = await screen.findByText("これ何ゴミ？");
    const panel = heading.closest("section") as HTMLElement;

    await user.type(within(panel).getByPlaceholderText("例: スプレー缶"), "アイスピック");
    await user.click(within(panel).getByText("検索"));

    expect(await within(panel).findByText("燃やさないごみ")).toBeInTheDocument();
    expect(within(panel).getByText("紙などに包み「きけん」と表示して")).toBeInTheDocument();
    expect(within(panel).queryByText(/参考:/)).not.toBeInTheDocument();
  });

  it("shows Sapporo's sorting as a labeled reference when an Ebetsu item isn't in Ebetsu's own (much smaller) keyword list", async () => {
    localStorage.clear();

    const user = userEvent.setup({ delay: null });
    render(<App />);

    await user.selectOptions(await screen.findByLabelText("自治体"), "ebetsu");
    await user.selectOptions(await screen.findByLabelText("お住まいの地区（町名）"), "緑町（東・西）");

    const heading = await screen.findByText("これ何ゴミ？");
    const panel = heading.closest("section") as HTMLElement;

    // "アイスピック" isn't one of Ebetsu's own hand-curated categories.json keywords, only Sapporo's
    // full sorting dictionary knows it — this should surface as a labeled reference, not a real answer.
    await user.type(within(panel).getByPlaceholderText("例: スプレー缶"), "アイスピック");
    await user.click(within(panel).getByText("検索"));

    expect(await within(panel).findByText("「アイスピック」は見つかりませんでした。")).toBeInTheDocument();
    expect(within(panel).getByText("参考: 札幌市の分別区分")).toBeInTheDocument();
    expect(within(panel).getByText("燃やせないごみ")).toBeInTheDocument();
    expect(within(panel).getByText(/実際の分別区分・手数料は自治体により異なります/)).toBeInTheDocument();
  });

  it("does not show a reference block for Sapporo itself, since it already has its own dictionary", async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);

    await selectArea(user);
    const heading = await screen.findByText("これ何ゴミ？");
    const panel = heading.closest("section") as HTMLElement;

    await user.type(within(panel).getByPlaceholderText("例: スプレー缶"), "アイスピック");
    await user.click(within(panel).getByText("検索"));

    expect(await within(panel).findByText("燃やせないごみ")).toBeInTheDocument();
    expect(within(panel).queryByText(/参考:/)).not.toBeInTheDocument();
  });
});

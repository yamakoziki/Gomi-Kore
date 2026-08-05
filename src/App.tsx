import { useEffect, useState } from "react";
import "./App.css";
import { areaMappingData, categoriesData, loadCalendar, sourceData } from "./adapters/sapporo";
import { AboutFooter } from "./components/AboutFooter";
import { AllCategoriesPanel } from "./components/AllCategoriesPanel";
import { AreaSelector } from "./components/AreaSelector";
import { TodayPanel } from "./components/TodayPanel";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { useSpeech } from "./hooks/useSpeech";
import type { CalendarData } from "./types";

type CalendarSource = "network" | "cache" | "bundled";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; calendar: CalendarData; source: CalendarSource }
  | { status: "error"; message: string };

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function App() {
  const [selectedAreaCode, setSelectedAreaCode] = useLocalStorageState<string | null>(
    "gomi-kore:sapporo:areaCode",
    null,
  );
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const { speak } = useSpeech();

  const fetchCalendar = () => {
    setLoadState({ status: "loading" });
    loadCalendar()
      .then((result) => setLoadState({ status: "ready", calendar: result.calendar, source: result.source }))
      .catch((error: unknown) =>
        setLoadState({ status: "error", message: error instanceof Error ? error.message : String(error) }),
      );
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  const selectedArea = areaMappingData.areas.find((area) => area.areaCode === selectedAreaCode) ?? null;
  const now = new Date();

  return (
    <div className="app">
      <header className="app__header">
        <h1>ごみコレ</h1>
        <p className="app__tagline">今日のゴミ、聞かなくても分かる。（{sourceData.municipalityName}版）</p>
      </header>

      <main className="app__main">
        <AreaSelector
          areaMapping={areaMappingData}
          selectedAreaCode={selectedAreaCode}
          onChange={setSelectedAreaCode}
        />

        {loadState.status === "loading" && <p className="app__status">カレンダーを読み込んでいます…</p>}

        {loadState.status === "error" && (
          <div className="app__status app__status--error">
            <p>データの取得に失敗しました: {loadState.message}</p>
            <button type="button" onClick={fetchCalendar}>
              再試行
            </button>
          </div>
        )}

        {loadState.status === "ready" && selectedArea && (
          <>
            <div className="app__meta">
              <span>この情報は {formatDateTime(loadState.calendar.fetchedAt)} 時点のものです。</span>
              {loadState.source === "cache" && (
                <span className="app__meta-cache">（通信に失敗したため保存済みデータを表示中）</span>
              )}
              {loadState.source === "bundled" && (
                <span className="app__meta-cache">（この端末での最新データ取得に失敗したため、アプリに同梱のデータを表示中）</span>
              )}
              <button type="button" className="app__refresh" onClick={fetchCalendar}>
                更新
              </button>
            </div>

            <TodayPanel
              calendar={loadState.calendar}
              categoriesData={categoriesData}
              areaColumnName={selectedArea.columnName}
              now={now}
              onSpeak={speak}
            />

            <AllCategoriesPanel
              calendar={loadState.calendar}
              categoriesData={categoriesData}
              areaColumnName={selectedArea.columnName}
              now={now}
            />
          </>
        )}

        {loadState.status === "ready" && !selectedArea && (
          <p className="app__status">上の欄からお住まいの地区を選択してください。</p>
        )}
      </main>

      <AboutFooter source={sourceData} />
    </div>
  );
}

export default App;

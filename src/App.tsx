import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./App.css";
import { areaMappingData, categoriesData, loadCalendar, sourceData } from "./adapters/sapporo";
import { AboutFooter } from "./components/AboutFooter";
import { AllCategoriesPanel } from "./components/AllCategoriesPanel";
import { AreaSelector } from "./components/AreaSelector";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { TodayPanel } from "./components/TodayPanel";
import { UpdateToast } from "./components/UpdateToast";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { useNow } from "./hooks/useNow";
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
  const { t } = useTranslation();
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
  const now = useNow();

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-row">
          <h1>ごみコレ</h1>
          <LanguageSwitcher />
        </div>
        <p className="app__tagline">{t("app.tagline", { municipality: sourceData.municipalityName })}</p>
      </header>

      <main className="app__main">
        <AreaSelector
          areaMapping={areaMappingData}
          selectedAreaCode={selectedAreaCode}
          onChange={setSelectedAreaCode}
        />

        {loadState.status === "loading" && <p className="app__status">{t("app.loading")}</p>}

        {loadState.status === "error" && (
          <div className="app__status app__status--error">
            <p>{t("app.errorPrefix", { message: loadState.message })}</p>
            <button type="button" onClick={fetchCalendar}>
              {t("app.retry")}
            </button>
          </div>
        )}

        {loadState.status === "ready" && selectedArea && (
          <>
            <div className="app__meta">
              <span>{t("app.lastUpdated", { datetime: formatDateTime(loadState.calendar.fetchedAt) })}</span>
              {loadState.source === "cache" && <span className="app__meta-cache">{t("app.fromCache")}</span>}
              {loadState.source === "bundled" && <span className="app__meta-cache">{t("app.fromBundled")}</span>}
              <button type="button" className="app__refresh" onClick={fetchCalendar}>
                {t("app.refresh")}
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

        {loadState.status === "ready" && !selectedArea && <p className="app__status">{t("app.selectAreaPrompt")}</p>}
      </main>

      <AboutFooter source={sourceData} />
      <UpdateToast />
    </div>
  );
}

export default App;

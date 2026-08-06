import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./App.css";
import { getAdapter, municipalityManifest } from "./adapters/registry";
import type { AdapterModule } from "./adapters/registry";
import { AboutFooter } from "./components/AboutFooter";
import { AllCategoriesPanel } from "./components/AllCategoriesPanel";
import { AreaSelector } from "./components/AreaSelector";
import { ItemSearchPanel } from "./components/ItemSearchPanel";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { MunicipalitySelector } from "./components/MunicipalitySelector";
import { TodayPanel } from "./components/TodayPanel";
import { UpdateToast } from "./components/UpdateToast";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { useNow } from "./hooks/useNow";
import { useSpeech } from "./hooks/useSpeech";
import type { CalendarData } from "./types";

const MUNICIPALITY_STORAGE_KEY = "gomi-kore:municipalityCode";
const LEGACY_SAPPORO_AREA_CODE_KEY = "gomi-kore:sapporo:areaCode";

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

/** Users who already had a Sapporo area selected before multi-municipality support existed keep that selection. */
function readLegacySapporoAreaCode(): string | null {
  try {
    const raw = localStorage.getItem(LEGACY_SAPPORO_AREA_CODE_KEY);
    return raw !== null ? (JSON.parse(raw) as string | null) : null;
  } catch {
    return null;
  }
}

function App() {
  const legacyAreaCode = readLegacySapporoAreaCode();
  const [municipalityCode, setMunicipalityCode] = useLocalStorageState<string | null>(
    MUNICIPALITY_STORAGE_KEY,
    legacyAreaCode ? "sapporo" : null,
  );

  const adapter = municipalityCode ? getAdapter(municipalityCode) : null;

  if (!adapter) {
    return (
      <div className="app">
        <header className="app__header">
          <div className="app__header-row">
            <h1>ごみコレ</h1>
            <LanguageSwitcher />
          </div>
        </header>
        <main className="app__main">
          <MunicipalitySelector manifest={municipalityManifest} onSelect={setMunicipalityCode} />
        </main>
      </div>
    );
  }

  // Remounts the whole subtree (and its per-municipality localStorage-backed state) whenever the municipality changes.
  return (
    <MunicipalityApp
      key={adapter.MUNICIPALITY_CODE}
      adapter={adapter}
      onChangeMunicipality={() => setMunicipalityCode(null)}
    />
  );
}

function MunicipalityApp({
  adapter,
  onChangeMunicipality,
}: {
  adapter: AdapterModule;
  onChangeMunicipality: () => void;
}) {
  const { categoriesData, areaMappingData, sourceData, loadCalendar, MUNICIPALITY_CODE } = adapter;
  const { t } = useTranslation();
  const [selectedAreaCode, setSelectedAreaCode] = useLocalStorageState<string | null>(
    `gomi-kore:${MUNICIPALITY_CODE}:areaCode`,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <button type="button" className="app__change-municipality" onClick={onChangeMunicipality}>
          {t("app.changeMunicipality")}
        </button>
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

            <ItemSearchPanel
              categoriesData={categoriesData}
              calendar={loadState.calendar}
              areaColumnName={selectedArea.columnName}
              now={now}
              source={sourceData}
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

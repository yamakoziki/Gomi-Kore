import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarData, CategoriesData, SourceData } from "../types";
import { searchCategories } from "../logic/itemSearch";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { pickLocalized } from "../i18n/localized";
import { CategoryCard } from "./CategoryCard";

type Props = {
  categoriesData: CategoriesData;
  calendar: CalendarData;
  areaColumnName: string;
  now: Date;
  source: SourceData;
  onSpeak: (text: string, language: string) => void;
};

export function ItemSearchPanel({ categoriesData, calendar, areaColumnName, now, source, onSpeak }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "ja";
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const { supported: voiceSupported, listening, error: voiceError, start, stop } = useVoiceInput(language);

  const match = searchedQuery ? searchCategories(categoriesData, searchedQuery) : null;

  const runSearch = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSearchedQuery(trimmed);
    const result = searchCategories(categoriesData, trimmed);
    const categoryName = result
      ? pickLocalized(result.matchedSubItem?.name ?? result.category.name, language)
      : null;
    onSpeak(
      categoryName
        ? t("itemSearch.speechResult", { item: trimmed, category: categoryName })
        : t("itemSearch.speechNotFound", { item: trimmed }),
      language,
    );
  };

  const handleMicClick = () => {
    if (listening) {
      stop();
      return;
    }
    start((transcript) => runSearch(transcript));
  };

  return (
    <section className="item-search-panel">
      <h2>{t("itemSearch.heading")}</h2>
      <p className="item-search-panel__hint">{t("itemSearch.hint")}</p>

      <form
        className="item-search-panel__form"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch(query);
        }}
      >
        <input
          type="text"
          className="item-search-panel__input"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSearchedQuery(null);
          }}
          placeholder={t("itemSearch.placeholder")}
          aria-label={t("itemSearch.placeholder")}
        />
        {voiceSupported && (
          <button
            type="button"
            className={`item-search-panel__mic${listening ? " item-search-panel__mic--active" : ""}`}
            onClick={handleMicClick}
            aria-pressed={listening}
            aria-label={t("itemSearch.micLabel")}
          >
            {listening ? "⏹️" : "🎤"}
          </button>
        )}
        <button type="submit" className="item-search-panel__submit">
          {t("itemSearch.searchButton")}
        </button>
      </form>

      {listening && <p className="item-search-panel__status">{t("itemSearch.listening")}</p>}
      {voiceError === "denied" && <p className="item-search-panel__status item-search-panel__status--error">{t("itemSearch.micDenied")}</p>}
      {voiceError === "no-speech" && <p className="item-search-panel__status item-search-panel__status--error">{t("itemSearch.micNoSpeech")}</p>}
      {voiceError === "other" && <p className="item-search-panel__status item-search-panel__status--error">{t("itemSearch.micOther")}</p>}

      {searchedQuery &&
        (match ? (
          <div className="item-search-panel__result">
            <CategoryCard
              category={match.category}
              calendar={calendar}
              areaColumnName={areaColumnName}
              fromDate={now}
              defaultExpanded
            />
          </div>
        ) : (
          <div className="item-search-panel__not-found">
            <p>{t("itemSearch.notFound", { query: searchedQuery })}</p>
            <a href={source.sortingDictionaryUrl} target="_blank" rel="noreferrer">
              {t("itemSearch.officialDictionaryLink", { municipality: source.municipalityName })}
            </a>
          </div>
        ))}
    </section>
  );
}

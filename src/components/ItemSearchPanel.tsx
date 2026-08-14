import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarData, CategoriesData, ItemDictionaryData, SourceData } from "../types";
import type { ReferenceItemDictionary } from "../adapters/registry";
import { searchCategories, searchItemDictionary } from "../logic/itemSearch";
import type { ItemDictionaryMatch } from "../logic/itemSearch";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { pickLocalized } from "../i18n/localized";
import { CategoryCard } from "./CategoryCard";
import { FeeBadge } from "./FeeBadge";

type Props = {
  categoriesData: CategoriesData;
  calendar: CalendarData;
  areaColumnName: string;
  now: Date;
  source: SourceData;
  /** Full item-by-item sorting dictionary, when the municipality has one bundled (currently Sapporo only). Its raw text is Japanese-only, so it's only consulted while the UI language is Japanese. */
  itemDictionaryData?: ItemDictionaryData;
  /** Another municipality's item dictionary (currently only Sapporo's), shown as a labeled, non-authoritative reference for municipalities without one of their own. Null when this municipality already has its own. */
  referenceItemDictionary?: ReferenceItemDictionary | null;
  onSpeak: (text: string, language: string) => void;
};

const SPECIAL_HEADING_KEY: Record<NonNullable<ItemDictionaryMatch["entry"]["special"]>, string> = {
  not_collected: "itemSearch.special.notCollected",
  community_recycling: "itemSearch.special.communityRecycling",
  see_note: "itemSearch.special.seeNote",
};

const SPECIAL_SPEECH_KEY: Record<NonNullable<ItemDictionaryMatch["entry"]["special"]>, string> = {
  not_collected: "itemSearch.speechSpecial.notCollected",
  community_recycling: "itemSearch.speechSpecial.communityRecycling",
  see_note: "itemSearch.speechSpecial.seeNote",
};

export function ItemSearchPanel({
  categoriesData,
  calendar,
  areaColumnName,
  now,
  source,
  itemDictionaryData,
  referenceItemDictionary,
  onSpeak,
}: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "ja";
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
  const { supported: voiceSupported, listening, error: voiceError, start, stop } = useVoiceInput(language);

  // The dictionary's item names and notes are scraped Japanese city-website text with no translation, so it's only consulted in Japanese; English falls back to the hand-curated bilingual categories.json keywords below.
  const useDictionary = language === "ja" && Boolean(itemDictionaryData);
  const dictMatch =
    searchedQuery && useDictionary ? searchItemDictionary(categoriesData, itemDictionaryData!, searchedQuery) : null;
  const categoryMatch = searchedQuery && !dictMatch ? searchCategories(categoriesData, searchedQuery) : null;

  // Same Japanese-only caveat as useDictionary above.
  const referenceMatch =
    searchedQuery && language === "ja" && referenceItemDictionary
      ? searchItemDictionary(referenceItemDictionary.categoriesData, referenceItemDictionary.itemDictionaryData, searchedQuery)
      : null;

  const runSearch = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setSearchedQuery(trimmed);

    const dict = useDictionary ? searchItemDictionary(categoriesData, itemDictionaryData!, trimmed) : null;
    if (dict) {
      if (dict.category) {
        const categoryName = pickLocalized(dict.subItem?.name ?? dict.category.name, language);
        onSpeak(t("itemSearch.speechResult", { item: trimmed, category: categoryName }), language);
      } else if (dict.entry.special) {
        onSpeak(
          t(SPECIAL_SPEECH_KEY[dict.entry.special], { item: trimmed, note: dict.entry.note ?? "" }),
          language,
        );
      }
      return;
    }

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

      {searchedQuery && dictMatch?.category && (
        <div className="item-search-panel__result">
          <p className="item-search-panel__matched-item">{dictMatch.entry.name}</p>
          <CategoryCard
            category={dictMatch.category}
            calendar={calendar}
            areaColumnName={areaColumnName}
            fromDate={now}
            defaultExpanded
          />
          {dictMatch.entry.note && <p className="item-search-panel__dictionary-note">{dictMatch.entry.note}</p>}
        </div>
      )}

      {searchedQuery && dictMatch && !dictMatch.category && dictMatch.entry.special && (
        <div className="item-search-panel__result item-search-panel__special">
          <p className="item-search-panel__matched-item">{dictMatch.entry.name}</p>
          <p className="item-search-panel__special-heading">{t(SPECIAL_HEADING_KEY[dictMatch.entry.special])}</p>
          {dictMatch.entry.note && <p className="item-search-panel__special-note">{dictMatch.entry.note}</p>}
        </div>
      )}

      {searchedQuery && !dictMatch && (
        <>
          {categoryMatch ? (
            <div className="item-search-panel__result">
              <CategoryCard
                category={categoryMatch.category}
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
          )}
        </>
      )}

      {searchedQuery && referenceMatch && (
        <div className="item-search-panel__reference">
          <p className="item-search-panel__reference-heading">
            {t("itemSearch.referenceHeading", { municipality: referenceItemDictionary!.municipalityName })}
          </p>
          <p className="item-search-panel__matched-item">{referenceMatch.entry.name}</p>
          {referenceMatch.category ? (
            <div className="item-search-panel__reference-category">
              <span>{pickLocalized(referenceMatch.subItem?.name ?? referenceMatch.category.name, language)}</span>
              <FeeBadge feeType={(referenceMatch.subItem ?? referenceMatch.category).feeType} />
            </div>
          ) : (
            referenceMatch.entry.special && (
              <p className="item-search-panel__reference-category">{t(SPECIAL_HEADING_KEY[referenceMatch.entry.special])}</p>
            )
          )}
          {referenceMatch.entry.note && <p className="item-search-panel__reference-note">{referenceMatch.entry.note}</p>}
          <p className="item-search-panel__reference-disclaimer">
            {t("itemSearch.referenceDisclaimer", { municipality: referenceItemDictionary!.municipalityName })}
          </p>
        </div>
      )}
    </section>
  );
}

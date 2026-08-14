export type LocalizedText = {
  ja: string;
  en?: string;
};

export type FeeType = "free" | "designated_bag" | "sticker_required";

export type ScheduleType = "regular" | "on_request";

export type CategorySubItem = {
  id: string;
  name: LocalizedText;
  feeType: FeeType;
  feeNote?: LocalizedText;
  /** Extra search aliases (item nicknames, synonyms) matched by the "何ゴミ？" item search, in addition to `name`. */
  keywords?: string[];
};

export type CategoryContact = {
  phone?: string;
  webUrl?: string;
  infoUrl?: string;
};

export type Category = {
  /** Numeric code used in the collection calendar. Absent for on_request categories. */
  code?: string;
  id: string;
  name: LocalizedText;
  scheduleType: ScheduleType;
  feeType: FeeType;
  feeNote?: LocalizedText;
  subItem?: CategorySubItem;
  contact?: CategoryContact;
  /** Extra search aliases (item nicknames, synonyms) matched by the "何ゴミ？" item search, in addition to `name`. */
  keywords?: string[];
};

export type CategoriesData = {
  municipalityCode: string;
  categories: Category[];
  noCollection: {
    code: string;
    label: LocalizedText;
  };
};

export type AreaInfo = {
  areaCode: string;
  columnName: string;
  /** Ward name, for municipalities with a ward-level grouping (e.g. Sapporo). Omitted for flat municipalities. */
  wardName?: string;
  /** Sub-area number within a ward (e.g. Sapporo). Omitted for flat municipalities. */
  subAreaNumber?: number;
  /** Raw display label (e.g. a town/address name) for municipalities without ward grouping (e.g. Otaru). */
  label?: string;
};

export type AreaMappingData = {
  municipalityCode: string;
  note: string;
  /** Ward names, for municipalities with a ward-level grouping. Omitted for flat municipalities. */
  wards?: string[];
  /** JIS municipality code (5 digits) -> ward name, used to resolve geolocation to a ward. Omitted for flat municipalities. */
  wardMuniCodes?: Record<string, string>;
  areas: AreaInfo[];
};

/** One day's row from the collection calendar. `areas` maps columnName -> category code (or null/empty for no collection). */
export type CalendarDay = {
  date: string; // YYYY-MM-DD
  weekday: string;
  areas: Record<string, string | null>;
};

export type CalendarData = {
  municipalityCode: string;
  periodStart: string;
  periodEnd: string;
  days: CalendarDay[];
  fetchedAt: string;
};

export type SourceData = {
  municipalityCode: string;
  municipalityName: string;
  provider: string;
  datasetName: string;
  license: string;
  creditText: string;
  officialUrl: string;
  /** Official item-by-item sorting dictionary (50-on order), e.g. Sapporo's 家庭ごみ50音分別辞典. Always link out to it as the authoritative source. */
  sortingDictionaryUrl: string;
  /** Credit line for the sorting dictionary content bundled as ItemDictionaryData, when reproduced with the municipality's permission (distinct from `creditText`, which covers the CC-BY open dataset). Omitted if no such content is bundled for this municipality. */
  itemDictionaryCreditText?: string;
  datasetUrl: string;
  calendarPeriod: { start: string; end: string };
  lastVerifiedAt: string;
  // CKAN datastore_search API fields (Sapporo-style sources). Omitted for plain CSV-download sources.
  datasetSlug?: string;
  apiBaseUrl?: string;
  packageShowUrl?: string;
  categoryTableResourceId?: string;
  calendarResourceId?: string;
  // Plain CSV-download fields (Otaru-style sources). Omitted for CKAN API sources.
  csvIndexUrl?: string;
  calendarCsvUrl?: string;
  areaMappingCsvUrl?: string;
  itemDictionaryCsvUrl?: string;
};

export type LoadCalendarResult = {
  calendar: CalendarData;
  source: "network" | "cache" | "bundled";
};

/**
 * `not_collected`: not picked up curbside at all (store return, dealer, a
 * specialist recycler, etc. — see the entry's `note`).
 * `community_recycling`: normally goes to a neighborhood 集団資源回収 /
 * drop-off point rather than curbside collection; `note` gives the fallback
 * curbside category for when that's not practical.
 * `see_note`: the right category depends on details only covered in `note`
 * (e.g. materials, size).
 */
export type ItemDictionarySpecialCase = "not_collected" | "community_recycling" | "see_note";

/** One row of a municipality's official item-by-item sorting dictionary (e.g. Sapporo's 50-on order 分別辞典). */
export type ItemDictionaryEntry = {
  name: string;
  /** categories.json category id this item resolves to, or null for a `special` case. */
  categoryId: string | null;
  /** categories.json subItem id, when this item is specifically that category's sub-item rather than the category itself. */
  subItemId: string | null;
  special: ItemDictionarySpecialCase | null;
  fee: string | null;
  note: string | null;
};

export type ItemDictionaryData = {
  municipalityCode: string;
  sourceUrl: string;
  items: ItemDictionaryEntry[];
};

export type MunicipalityManifestEntry = {
  code: string;
  name: string;
  prefecture: string;
  /** JIS municipality codes belonging to this municipality (multiple for ward-split cities like Sapporo). */
  muniCodes: string[];
};

export type MunicipalityManifest = {
  municipalities: MunicipalityManifestEntry[];
};

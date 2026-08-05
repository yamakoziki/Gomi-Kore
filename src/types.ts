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
  wardName: string;
  subAreaNumber: number;
  columnName: string;
};

export type AreaMappingData = {
  municipalityCode: string;
  note: string;
  wards: string[];
  /** JIS municipality code (5 digits) -> ward name, used to resolve geolocation to a ward. */
  wardMuniCodes: Record<string, string>;
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
  datasetUrl: string;
  datasetSlug: string;
  apiBaseUrl: string;
  packageShowUrl: string;
  categoryTableResourceId: string;
  calendarResourceId: string;
  calendarPeriod: { start: string; end: string };
  lastVerifiedAt: string;
};

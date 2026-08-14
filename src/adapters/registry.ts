import type {
  AreaMappingData,
  CategoriesData,
  ItemDictionaryData,
  LoadCalendarResult,
  MunicipalityManifest,
  SourceData,
} from "../types";
import municipalityManifestJson from "../../data/municipalities.json";
import * as sapporo from "./sapporo";
import * as otaru from "./otaru";
import * as ebetsu from "./ebetsu";

export type AdapterModule = {
  MUNICIPALITY_CODE: string;
  categoriesData: CategoriesData;
  areaMappingData: AreaMappingData;
  sourceData: SourceData;
  loadCalendar: () => Promise<LoadCalendarResult>;
  /** Full item-by-item sorting dictionary (e.g. Sapporo's 50-on 分別辞典), when the municipality has one bundled. */
  itemDictionaryData?: ItemDictionaryData;
};

export const municipalityManifest = municipalityManifestJson as MunicipalityManifest;

export const adapters: Record<string, AdapterModule> = {
  sapporo,
  otaru,
  ebetsu,
};

export function getAdapter(municipalityCode: string): AdapterModule | null {
  return adapters[municipalityCode] ?? null;
}

/** Resolves a JIS municipality code (from reverse geocoding) to a supported municipality code, or null if unsupported. */
export function resolveMunicipalityCodeFromMuniCode(muniCode: string): string | null {
  const entry = municipalityManifest.municipalities.find((m) => m.muniCodes.includes(muniCode));
  return entry?.code ?? null;
}

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

export type ReferenceItemDictionary = {
  municipalityName: string;
  categoriesData: CategoriesData;
  itemDictionaryData: ItemDictionaryData;
};

/**
 * For a municipality with no item-by-item sorting dictionary of its own,
 * surfaces another municipality's (currently only Sapporo's) as a
 * supplementary reference in the "これ何ゴミ？" search. It is never
 * authoritative for the current municipality — categories, fees, and
 * schedules can differ by city — but is a far larger dataset than any one
 * municipality's hand-curated categories.json `keywords` list, so it's shown
 * as a labeled "reference" alongside (not instead of) the current
 * municipality's own answer.
 */
export function getReferenceItemDictionary(currentMunicipalityCode: string): ReferenceItemDictionary | null {
  if (adapters[currentMunicipalityCode]?.itemDictionaryData) return null; // already has its own

  for (const [code, adapter] of Object.entries(adapters)) {
    if (code === currentMunicipalityCode) continue;
    if (adapter.itemDictionaryData) {
      return {
        municipalityName: adapter.sourceData.municipalityName,
        categoriesData: adapter.categoriesData,
        itemDictionaryData: adapter.itemDictionaryData,
      };
    }
  }
  return null;
}

/** Resolves a JIS municipality code (from reverse geocoding) to a supported municipality code, or null if unsupported. */
export function resolveMunicipalityCodeFromMuniCode(muniCode: string): string | null {
  const entry = municipalityManifest.municipalities.find((m) => m.muniCodes.includes(muniCode));
  return entry?.code ?? null;
}

import type { AreaMappingData, CategoriesData, LoadCalendarResult, MunicipalityManifest, SourceData } from "../types";
import municipalityManifestJson from "../../data/municipalities.json";
import * as sapporo from "./sapporo";
import * as otaru from "./otaru";

export type AdapterModule = {
  MUNICIPALITY_CODE: string;
  categoriesData: CategoriesData;
  areaMappingData: AreaMappingData;
  sourceData: SourceData;
  loadCalendar: () => Promise<LoadCalendarResult>;
};

export const municipalityManifest = municipalityManifestJson as MunicipalityManifest;

export const adapters: Record<string, AdapterModule> = {
  sapporo,
  otaru,
};

export function getAdapter(municipalityCode: string): AdapterModule | null {
  return adapters[municipalityCode] ?? null;
}

/** Resolves a JIS municipality code (from reverse geocoding) to a supported municipality code, or null if unsupported. */
export function resolveMunicipalityCodeFromMuniCode(muniCode: string): string | null {
  const entry = municipalityManifest.municipalities.find((m) => m.muniCodes.includes(muniCode));
  return entry?.code ?? null;
}

/**
 * Resolves latitude/longitude to a JIS municipality code using the
 * Geospatial Information Authority of Japan (国土地理院) reverse geocoder.
 * This is an official government API, sends Access-Control-Allow-Origin: *
 * (verified working from the browser, unlike the Sapporo CKAN API), and is
 * free with no API key required.
 */
const GSI_REVERSE_GEOCODER_URL = "https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress";

type GsiReverseGeocoderResponse = {
  results?: {
    muniCd?: string;
    lv01Nm?: string;
  } | null;
};

export type MunicipalityLookupResult =
  | { status: "found"; muniCode: string }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function lookupMunicipalityCode(latitude: number, longitude: number): Promise<MunicipalityLookupResult> {
  const url = new URL(GSI_REVERSE_GEOCODER_URL);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
  if (!response.ok) {
    return { status: "error", message: `GSI reverse geocoder request failed: ${response.status}` };
  }

  const json = (await response.json()) as GsiReverseGeocoderResponse;
  const muniCode = json.results?.muniCd;
  if (!muniCode) {
    return { status: "not_found" };
  }
  return { status: "found", muniCode };
}

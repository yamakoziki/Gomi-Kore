import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MunicipalityManifest } from "../types";
import { useGeolocation } from "../hooks/useGeolocation";
import { lookupMunicipalityCode } from "../adapters/geocode";
import { resolveMunicipalityCodeFromMuniCode } from "../adapters/registry";

type Props = {
  manifest: MunicipalityManifest;
  onSelect: (municipalityCode: string) => void;
};

type GeoLookupState = "idle" | "loading" | "success" | "not_supported" | "error";

export function MunicipalitySelector({ manifest, onSelect }: Props) {
  const { t } = useTranslation();
  const [geoLookup, setGeoLookup] = useState<GeoLookupState>("idle");
  const { state: geoState, requestLocation } = useGeolocation();

  useEffect(() => {
    if (geoState.status !== "success") return;
    let cancelled = false;
    setGeoLookup("loading");
    lookupMunicipalityCode(geoState.latitude, geoState.longitude).then((result) => {
      if (cancelled) return;
      if (result.status === "found") {
        const municipalityCode = resolveMunicipalityCodeFromMuniCode(result.muniCode);
        if (municipalityCode) {
          setGeoLookup("success");
          onSelect(municipalityCode);
        } else {
          setGeoLookup("not_supported");
        }
      } else {
        setGeoLookup("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [geoState, onSelect]);

  const geoBusy = geoState.status === "loading" || geoLookup === "loading";

  return (
    <div className="area-selector">
      <p className="area-selector__hint">{t("municipalitySelector.heading")}</p>

      <div className="area-selector__geo">
        <button type="button" onClick={requestLocation} disabled={geoBusy}>
          {t("municipalitySelector.detectButton")}
        </button>
        {geoBusy && <p className="area-selector__geo-message">{t("municipalitySelector.detecting")}</p>}
        {geoState.status === "error" && (
          <p className="area-selector__geo-message area-selector__geo-message--error">
            {t(`municipalitySelector.geoError.${geoState.code}`)}
          </p>
        )}
        {geoLookup === "not_supported" && (
          <p className="area-selector__geo-message area-selector__geo-message--error">
            {t("municipalitySelector.notSupported")}
          </p>
        )}
        {geoLookup === "error" && (
          <p className="area-selector__geo-message area-selector__geo-message--error">
            {t("municipalitySelector.geoLookupError")}
          </p>
        )}
      </div>

      <div className="area-selector__row">
        <label htmlFor="municipality-select">{t("municipalitySelector.selectLabel")}</label>
        <select
          id="municipality-select"
          value=""
          onChange={(event) => {
            if (event.target.value) onSelect(event.target.value);
          }}
        >
          <option value="" disabled>
            {t("municipalitySelector.placeholder")}
          </option>
          {manifest.municipalities.map((m) => (
            <option key={m.code} value={m.code}>
              {m.prefecture}
              {m.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

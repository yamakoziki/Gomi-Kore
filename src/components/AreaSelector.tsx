import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AreaMappingData } from "../types";
import { pickWardName } from "../i18n/localized";
import { useGeolocation } from "../hooks/useGeolocation";
import { lookupMunicipalityCode } from "../adapters/geocode";

type Props = {
  areaMapping: AreaMappingData;
  selectedAreaCode: string | null;
  onChange: (areaCode: string) => void;
};

function findAreaInfo(areaMapping: AreaMappingData, areaCode: string | null) {
  if (!areaCode) return null;
  return areaMapping.areas.find((area) => area.areaCode === areaCode) ?? null;
}

type GeoLookupState = "idle" | "loading" | "success" | "not_sapporo" | "error";

export function AreaSelector({ areaMapping, selectedAreaCode, onChange }: Props) {
  const { t } = useTranslation();
  const wardTranslations = t("wards", { returnObjects: true }) as Record<string, string>;

  const initial = findAreaInfo(areaMapping, selectedAreaCode);
  const [ward, setWard] = useState<string | null>(initial?.wardName ?? null);
  const [subAreaNumber, setSubAreaNumber] = useState<number | null>(initial?.subAreaNumber ?? null);
  const [geoLookup, setGeoLookup] = useState<GeoLookupState>("idle");
  const { state: geoState, requestLocation } = useGeolocation();

  useEffect(() => {
    const info = findAreaInfo(areaMapping, selectedAreaCode);
    setWard((current) => info?.wardName ?? current);
    setSubAreaNumber((current) => info?.subAreaNumber ?? current);
  }, [areaMapping, selectedAreaCode]);

  useEffect(() => {
    if (geoState.status !== "success") return;
    let cancelled = false;
    setGeoLookup("loading");
    lookupMunicipalityCode(geoState.latitude, geoState.longitude).then((result) => {
      if (cancelled) return;
      if (result.status === "found") {
        const wardName = areaMapping.wardMuniCodes[result.muniCode];
        if (wardName) {
          setWard(wardName);
          setSubAreaNumber(null);
          setGeoLookup("success");
        } else {
          setGeoLookup("not_sapporo");
        }
      } else {
        setGeoLookup("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [geoState, areaMapping.wardMuniCodes]);

  useEffect(() => {
    if (ward && subAreaNumber) {
      const areaCode = `${ward}${subAreaNumber}`;
      if (areaCode !== selectedAreaCode) onChange(areaCode);
    }
  }, [ward, subAreaNumber, selectedAreaCode, onChange]);

  const subAreasForWard = ward ? areaMapping.areas.filter((area) => area.wardName === ward) : [];
  const geoBusy = geoState.status === "loading" || geoLookup === "loading";

  return (
    <div className="area-selector">
      <div className="area-selector__geo">
        <button type="button" onClick={requestLocation} disabled={geoBusy}>
          {t("areaSelector.detectButton")}
        </button>
        {geoBusy && <p className="area-selector__geo-message">{t("areaSelector.detecting")}</p>}
        {geoState.status === "error" && (
          <p className="area-selector__geo-message area-selector__geo-message--error">
            {t(`areaSelector.geoError.${geoState.code}`)}
          </p>
        )}
        {geoLookup === "not_sapporo" && (
          <p className="area-selector__geo-message area-selector__geo-message--error">{t("areaSelector.notSapporo")}</p>
        )}
        {geoLookup === "error" && (
          <p className="area-selector__geo-message area-selector__geo-message--error">{t("areaSelector.geoLookupError")}</p>
        )}
        {geoLookup === "success" && ward && (
          <p className="area-selector__geo-message area-selector__geo-message--success">
            {t("areaSelector.detectedWard", { ward: pickWardName(wardTranslations, ward) })}
          </p>
        )}
      </div>

      <div className="area-selector__row">
        <label htmlFor="ward-select">{t("areaSelector.wardLabel")}</label>
        <select
          id="ward-select"
          value={ward ?? ""}
          onChange={(event) => {
            setWard(event.target.value || null);
            setSubAreaNumber(null);
          }}
        >
          <option value="" disabled>
            {t("areaSelector.placeholder")}
          </option>
          {areaMapping.wards.map((wardName) => (
            <option key={wardName} value={wardName}>
              {pickWardName(wardTranslations, wardName)}
            </option>
          ))}
        </select>
      </div>

      <div className="area-selector__row">
        <label htmlFor="subarea-select">{t("areaSelector.districtSelectLabel")}</label>
        <select
          id="subarea-select"
          value={subAreaNumber ?? ""}
          disabled={!ward}
          onChange={(event) => setSubAreaNumber(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="" disabled>
            {t("areaSelector.placeholder")}
          </option>
          {subAreasForWard.map((area) => (
            <option key={area.areaCode} value={area.subAreaNumber}>
              {t("areaSelector.district", { number: area.subAreaNumber })}
            </option>
          ))}
        </select>
      </div>

      <p className="area-selector__hint">{t("areaSelector.hint")}</p>
    </div>
  );
}

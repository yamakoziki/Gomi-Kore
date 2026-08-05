import type { AreaMappingData } from "../types";

type Props = {
  areaMapping: AreaMappingData;
  selectedAreaCode: string | null;
  onChange: (areaCode: string) => void;
};

export function AreaSelector({ areaMapping, selectedAreaCode, onChange }: Props) {
  return (
    <div className="area-selector">
      <label htmlFor="area-select">お住まいの地区を選択してください</label>
      <select
        id="area-select"
        value={selectedAreaCode ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          選択してください
        </option>
        {areaMapping.wards.map((ward) => (
          <optgroup key={ward} label={ward}>
            {areaMapping.areas
              .filter((area) => area.wardName === ward)
              .map((area) => (
                <option key={area.areaCode} value={area.areaCode}>
                  {area.wardName} 第{area.subAreaNumber}地区
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <p className="area-selector__hint">
        現在地からの自動判定は未対応です。市の「家庭ごみ収集日カレンダー」で自分の地区番号をご確認のうえ選択してください。
      </p>
    </div>
  );
}

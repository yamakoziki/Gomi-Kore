import { useTranslation } from "react-i18next";
import type { FeeType } from "../types";

export function FeeBadge({ feeType }: { feeType: FeeType }) {
  const { t } = useTranslation();
  const isFree = feeType === "free";
  return (
    <span className={`fee-badge ${isFree ? "fee-badge--free" : "fee-badge--paid"}`}>
      {t(`fee.${feeType}`)}
    </span>
  );
}

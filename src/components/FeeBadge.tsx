import type { FeeType } from "../types";

const LABELS: Record<FeeType, string> = {
  free: "無料",
  designated_bag: "有料（指定袋）",
  sticker_required: "有料（申込制）",
};

export function FeeBadge({ feeType }: { feeType: FeeType }) {
  const isFree = feeType === "free";
  return (
    <span className={`fee-badge ${isFree ? "fee-badge--free" : "fee-badge--paid"}`}>
      {LABELS[feeType]}
    </span>
  );
}

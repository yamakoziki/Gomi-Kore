import { useState } from "react";
import type { CalendarData, Category } from "../types";
import { getNextCollectionDate } from "../logic/collection";
import { toDateKey } from "../logic/date";
import { FeeBadge } from "./FeeBadge";

type Props = {
  category: Category;
  calendar: CalendarData;
  areaColumnName: string;
  fromDate: Date;
};

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}（${["日", "月", "火", "水", "木", "金", "土"][date.getDay()]}）`;
}

export function CategoryCard({ category, calendar, areaColumnName, fromDate }: Props) {
  const [nextDate, setNextDate] = useState<Date | null | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);

  const isOnRequest = category.scheduleType === "on_request";

  const handleTap = () => {
    setExpanded((prev) => !prev);
    if (!isOnRequest && nextDate === undefined && category.code) {
      setNextDate(getNextCollectionDate(calendar, areaColumnName, category.code, fromDate));
    }
  };

  return (
    <button type="button" className="category-card" onClick={handleTap} aria-expanded={expanded}>
      <div className="category-card__header">
        <span className="category-card__name">{category.name.ja}</span>
        <FeeBadge feeType={category.feeType} />
      </div>
      {expanded && (
        <div className="category-card__details">
          {category.feeNote && <p className="category-card__fee-note">{category.feeNote.ja}</p>}
          {category.subItem && (
            <p className="category-card__sub-item">
              ※ {category.subItem.name.ja}（{category.subItem.feeType === "free" ? "無料" : "有料"}）も同時収集
              {category.subItem.feeNote ? `：${category.subItem.feeNote.ja}` : ""}
            </p>
          )}
          {isOnRequest ? (
            <div className="category-card__contact">
              <p>事前申込が必要です。</p>
              {category.contact?.phone && <p>電話: {category.contact.phone}</p>}
              {category.contact?.webUrl && (
                <p>
                  <a href={category.contact.webUrl} target="_blank" rel="noreferrer">
                    インターネット申込はこちら
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p className="category-card__next-date">
              次回収集日: {nextDate ? formatDate(nextDate) : "未定（データ範囲外）"}
              {nextDate && toDateKey(nextDate) === toDateKey(fromDate) ? "（本日）" : ""}
            </p>
          )}
        </div>
      )}
    </button>
  );
}

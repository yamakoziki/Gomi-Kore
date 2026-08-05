import type { CalendarData, CategoriesData } from "../types";
import { getCategoriesForDate } from "../logic/collection";
import { getTargetDate, getTargetDay } from "../logic/date";
import { CategoryCard } from "./CategoryCard";

type Props = {
  calendar: CalendarData;
  categoriesData: CategoriesData;
  areaColumnName: string;
  now: Date;
  onSpeak: (text: string) => void;
};

function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function TodayPanel({ calendar, categoriesData, areaColumnName, now, onSpeak }: Props) {
  const targetDay = getTargetDay(now);
  const targetDate = getTargetDate(now);
  const categories = getCategoriesForDate(calendar, categoriesData, areaColumnName, targetDate);

  const dayLabel = targetDay === "today" ? "今日" : "明日";

  const speechText =
    categories.length === 0
      ? `${dayLabel} ${formatMonthDay(targetDate)}は、収集はありません。`
      : `${dayLabel} ${formatMonthDay(targetDate)}のごみは、${categories.map((c) => c.name.ja).join("と")}です。`;

  return (
    <section className="today-panel" aria-live="polite">
      <div className="today-panel__heading">
        <h2>
          {dayLabel}（{formatMonthDay(targetDate)}）のごみ
        </h2>
        <button type="button" className="speak-button" onClick={() => onSpeak(speechText)}>
          🔊 読み上げる
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="today-panel__empty">収集はありません。</p>
      ) : (
        <div className="today-panel__categories">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              calendar={calendar}
              areaColumnName={areaColumnName}
              fromDate={targetDate}
            />
          ))}
        </div>
      )}
    </section>
  );
}

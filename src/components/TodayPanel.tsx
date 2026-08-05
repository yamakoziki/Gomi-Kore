import { useTranslation } from "react-i18next";
import type { CalendarData, CategoriesData } from "../types";
import { getCategoriesForDate } from "../logic/collection";
import { getTargetDate, getTargetDay } from "../logic/date";
import { formatMonthDay, pickLocalized } from "../i18n/localized";
import { CategoryCard } from "./CategoryCard";

type Props = {
  calendar: CalendarData;
  categoriesData: CategoriesData;
  areaColumnName: string;
  now: Date;
  onSpeak: (text: string, language: string) => void;
};

export function TodayPanel({ calendar, categoriesData, areaColumnName, now, onSpeak }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "ja";

  const targetDay = getTargetDay(now);
  const targetDate = getTargetDate(now);
  const categories = getCategoriesForDate(calendar, categoriesData, areaColumnName, targetDate);

  const dayLabel = t(targetDay === "today" ? "today.todayLabel" : "today.tomorrowLabel");
  const dateLabel = formatMonthDay(targetDate, language);

  const speechText =
    categories.length === 0
      ? t("today.speechEmpty", { day: dayLabel, date: dateLabel })
      : t("today.speechWithItems", {
          day: dayLabel,
          date: dateLabel,
          items: categories.map((c) => pickLocalized(c.name, language)).join(t("today.itemSeparator")),
        });

  return (
    <section className="today-panel" aria-live="polite">
      <div className="today-panel__heading">
        <h2>{t("today.heading", { day: dayLabel, date: dateLabel })}</h2>
        <button type="button" className="speak-button" onClick={() => onSpeak(speechText, language)}>
          {t("today.speak")}
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="today-panel__empty">{t("today.empty")}</p>
      ) : (
        <div className="today-panel__categories">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              calendar={calendar}
              areaColumnName={areaColumnName}
              fromDate={targetDate}
              today={now}
            />
          ))}
        </div>
      )}
    </section>
  );
}

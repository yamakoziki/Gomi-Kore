import { useTranslation } from "react-i18next";
import type { CalendarData, CategoriesData } from "../types";
import { CategoryCard } from "./CategoryCard";

type Props = {
  calendar: CalendarData;
  categoriesData: CategoriesData;
  areaColumnName: string;
  now: Date;
};

export function AllCategoriesPanel({ calendar, categoriesData, areaColumnName, now }: Props) {
  const { t } = useTranslation();
  return (
    <section className="all-categories-panel">
      <h2>{t("allCategories.heading")}</h2>
      <p className="all-categories-panel__hint">{t("allCategories.hint")}</p>
      <div className="all-categories-panel__list">
        {categoriesData.categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            calendar={calendar}
            areaColumnName={areaColumnName}
            fromDate={now}
          />
        ))}
      </div>
    </section>
  );
}

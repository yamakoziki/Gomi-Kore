import type { CalendarData, CategoriesData } from "../types";
import { CategoryCard } from "./CategoryCard";

type Props = {
  calendar: CalendarData;
  categoriesData: CategoriesData;
  areaColumnName: string;
  now: Date;
};

export function AllCategoriesPanel({ calendar, categoriesData, areaColumnName, now }: Props) {
  return (
    <section className="all-categories-panel">
      <h2>品目から調べる</h2>
      <p className="all-categories-panel__hint">タップすると次回の収集日（または申込方法）が分かります。</p>
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

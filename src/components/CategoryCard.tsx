import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarData, Category } from "../types";
import { getNextCollectionDate } from "../logic/collection";
import { toDateKey } from "../logic/date";
import { formatShortDate, pickLocalized } from "../i18n/localized";
import { FeeBadge } from "./FeeBadge";

type Props = {
  category: Category;
  calendar: CalendarData;
  areaColumnName: string;
  fromDate: Date;
  /** Skips the tap-to-reveal interaction and shows the details immediately, e.g. for item search results. */
  defaultExpanded?: boolean;
};

export function CategoryCard({ category, calendar, areaColumnName, fromDate, defaultExpanded = false }: Props) {
  const { t, i18n } = useTranslation();
  const [nextDate, setNextDate] = useState<Date | null | undefined>(undefined);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isOnRequest = category.scheduleType === "on_request";
  const language = i18n.resolvedLanguage ?? "ja";

  const revealDetails = () => {
    if (!isOnRequest && nextDate === undefined && category.code) {
      setNextDate(getNextCollectionDate(calendar, areaColumnName, category.code, fromDate));
    }
  };

  useEffect(() => {
    if (defaultExpanded) revealDetails();
    // Only re-run when the matched category itself changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id]);

  const handleTap = () => {
    setExpanded((prev) => !prev);
    revealDetails();
  };

  const header = (
    <div className="category-card__header">
      <span className="category-card__name">{pickLocalized(category.name, language)}</span>
      <FeeBadge feeType={category.feeType} />
    </div>
  );

  const details = expanded && (
    <div className="category-card__details">
      {category.feeNote && <p className="category-card__fee-note">{pickLocalized(category.feeNote, language)}</p>}
      {category.subItem && (
        <p className="category-card__sub-item">
          {t("category.subItemNote", {
            name: pickLocalized(category.subItem.name, language),
            fee: t(`fee.${category.subItem.feeType}`),
            feeNoteSuffix: category.subItem.feeNote ? `: ${pickLocalized(category.subItem.feeNote, language)}` : "",
          })}
        </p>
      )}
      {isOnRequest ? (
        <div className="category-card__contact">
          <p>{t("category.contactRequired")}</p>
          {category.contact?.phone && <p>{t("category.phoneLabel", { phone: category.contact.phone })}</p>}
          {category.contact?.webUrl && (
            <p>
              <a href={category.contact.webUrl} target="_blank" rel="noreferrer">
                {t("category.onlineApply")}
              </a>
            </p>
          )}
        </div>
      ) : (
        <p className="category-card__next-date">
          {t("category.nextDate", {
            date: nextDate ? formatShortDate(nextDate, language) : t("category.undetermined"),
          })}
          {nextDate && toDateKey(nextDate) === toDateKey(fromDate) ? t("category.todaySuffix") : ""}
        </p>
      )}
    </div>
  );

  if (defaultExpanded) {
    return (
      <div className="category-card category-card--static">
        {header}
        {details}
      </div>
    );
  }

  return (
    <button type="button" className="category-card" onClick={handleTap} aria-expanded={expanded}>
      {header}
      {details}
    </button>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SourceData } from "../types";

export function AboutFooter({ source }: { source: SourceData }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <footer className="about-footer">
      <button type="button" className="about-footer__toggle" onClick={() => setOpen((prev) => !prev)}>
        {t("about.toggle")}
      </button>
      {open && (
        <div className="about-footer__content">
          <p className="about-footer__disclaimer">
            {t("about.disclaimer", { municipality: source.municipalityName })}
          </p>
          <p>
            <a href={source.officialUrl} target="_blank" rel="noreferrer">
              {t("about.officialLink", { municipality: source.municipalityName })}
            </a>
          </p>
          <p>
            <a href={source.sortingDictionaryUrl} target="_blank" rel="noreferrer">
              {t("about.sortingDictionaryLink", { municipality: source.municipalityName })}
            </a>
          </p>
          <h3>{t("about.creditHeading")}</h3>
          <p>{source.creditText}</p>
          <p>
            <a href={source.datasetUrl} target="_blank" rel="noreferrer">
              {t("about.datasetLink", { dataset: source.datasetName })}
            </a>
          </p>
          <h3>{t("about.privacyHeading")}</h3>
          <p>{t("about.privacyBody")}</p>
          <h3>{t("about.termsHeading")}</h3>
          <p>{t("about.termsBody")}</p>
          <p className="about-footer__last-verified">{t("about.lastVerified", { date: source.lastVerifiedAt })}</p>
        </div>
      )}
    </footer>
  );
}

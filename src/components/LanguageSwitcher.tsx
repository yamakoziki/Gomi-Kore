import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n";

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <div className="language-switcher">
      <label htmlFor="language-select" className="language-switcher__label">
        {t("language.label")}
      </label>
      <select
        id="language-select"
        value={i18n.resolvedLanguage ?? "ja"}
        onChange={(event) => {
          void i18n.changeLanguage(event.target.value);
        }}
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>
            {t(`language.${lng}`)}
          </option>
        ))}
      </select>
    </div>
  );
}

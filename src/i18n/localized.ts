import type { LocalizedText } from "../types";

export function pickLocalized(text: LocalizedText, language: string): string {
  if (language.startsWith("en") && text.en) return text.en;
  return text.ja;
}

export function pickWardName(wardTranslations: Record<string, string>, wardName: string): string {
  return wardTranslations[wardName] ?? wardName;
}

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(language: string): Intl.DateTimeFormat {
  const locale = language.startsWith("en") ? "en-US" : "ja-JP";
  let formatter = dateFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric", weekday: "short" });
    dateFormatterCache.set(locale, formatter);
  }
  return formatter;
}

export function formatShortDate(date: Date, language: string): string {
  return getFormatter(language).format(date);
}

export function formatMonthDay(date: Date, language: string): string {
  const locale = language.startsWith("en") ? "en-US" : "ja-JP";
  return new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }).format(date);
}

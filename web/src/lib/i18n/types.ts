/**
 * Translation without a library.
 *
 * Locale lives in a cookie, which means server components can read it and render the right
 * language on the first paint — no flash of English, no locale segment in every URL. The whole
 * mechanism is a cookie, two dictionaries and a helper.
 */

export const LOCALES = ["tr", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Turkish is the default: this is built for a Turkish city, and the people using it at a
 * library desk in Konya should not have to switch away from English first.
 */
export const DEFAULT_LOCALE: Locale = "tr";

export const LOCALE_COOKIE = "cq_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** A string that exists in both languages. Used for catalogue content. */
export interface Localized {
  tr: string;
  en: string;
}

export function pick(text: Localized, locale: Locale): string {
  return text[locale];
}

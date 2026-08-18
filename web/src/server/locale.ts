import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/types";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";

/**
 * Reads the chosen language on the server, so every page renders in the right language on the
 * first paint. No flash of the wrong language, and no locale segment cluttering the URLs.
 */
export async function currentLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The pair every server component needs: what language, and the strings for it. */
export async function getTranslations(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await currentLocale();
  return { locale, t: getDictionary(locale) };
}

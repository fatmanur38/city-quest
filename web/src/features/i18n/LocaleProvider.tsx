"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/types";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionary";

/**
 * Makes the current language available to client components.
 *
 * Only the locale string crosses the server/client boundary; the dictionary is looked up on this
 * side. That is deliberate — the dictionary contains formatter functions like
 * `verifiedBy(issuer)`, and React cannot serialise a function from a server component into a
 * client one. Passing the two-letter code instead keeps those formatters, and keeps the type
 * safety that comes with them.
 */

interface LocaleState {
  locale: Locale;
  t: Dictionary;
}

const LocaleContext = createContext<LocaleState | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: getDictionary(locale) }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslations(): LocaleState {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useTranslations must be used inside LocaleProvider");
  return context;
}

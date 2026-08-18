"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/types";
import { useTranslations } from "./LocaleProvider";
import { cn } from "@/lib/cn";

/**
 * A two-language toggle, not a dropdown of forty.
 *
 * Setting the cookie is a server round-trip followed by `router.refresh()`, which re-renders the
 * server components in the new language. Slightly slower than swapping strings in the browser,
 * and worth it: the language a page was rendered in is then always the language in the cookie,
 * including for anything the server produced.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { locale, t } = useTranslations();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Locale | null>(null);
  const shown = optimistic ?? locale;

  function change(next: Locale) {
    if (next === shown) return;
    setOptimistic(next);
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
      setOptimistic(null);
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border-soft bg-paper-raised p-0.5",
        pending && "opacity-70",
      )}
      role="group"
      aria-label={t.nav.language}
    >
      {!compact ? (
        <Languages className="ml-2 size-3.5 shrink-0 text-ink-faint" aria-hidden />
      ) : null}
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => change(option)}
          aria-pressed={shown === option}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
            shown === option
              ? "bg-brand-600 text-white"
              : "text-ink-soft hover:bg-paper-sunk hover:text-ink",
          )}
          title={LOCALE_LABELS[option]}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

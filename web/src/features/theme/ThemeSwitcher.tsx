"use client";

import { useEffect, useState, useTransition } from "react";
import { Moon, Sun } from "lucide-react";
import type { Theme } from "@/lib/theme";
import { useTranslations } from "@/features/i18n/LocaleProvider";
import { cn } from "@/lib/cn";

/**
 * One button, because there are only two things a reader wants from it.
 *
 * The stored preference has three states -- the third is "system", which is what everyone starts
 * on. Pressing the button resolves whatever is currently showing into an explicit opposite, so
 * the first press always visibly does something, which a three-way cycle cannot promise.
 *
 * The class is applied to <html> immediately and the cookie written in the background: repainting
 * the page should not wait on a network round-trip.
 */
export function ThemeSwitcher({ initial }: { initial: Theme }) {
  const { t } = useTranslations();
  const [, startTransition] = useTransition();
  const [resolved, setResolved] = useState<"light" | "dark">(
    initial === "system" ? "light" : initial,
  );

  // On "system" the server cannot know which way the reader's device leans, so the button label
  // is corrected once on mount. Nothing moves; only the icon settles.
  useEffect(() => {
    if (initial !== "system") return;
    setResolved(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, [initial]);

  function toggle() {
    const next = resolved === "dark" ? "light" : "dark";
    setResolved(next);
    document.documentElement.dataset.theme = next;
    startTransition(async () => {
      await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
    });
  }

  const label = resolved === "dark" ? t.nav.switchToLight : t.nav.switchToDark;

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full border border-border-soft",
        "bg-paper-raised text-ink-soft transition-colors hover:bg-paper-sunk hover:text-ink",
      )}
    >
      {resolved === "dark" ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </button>
  );
}

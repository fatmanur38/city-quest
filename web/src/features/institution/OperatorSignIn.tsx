"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { institutionTypeLabel } from "@/lib/chain/contracts";
import { useTranslations } from "@/features/i18n/LocaleProvider";

export interface SelectableInstitution {
  slug: string;
  name: string;
  emoji: string;
  kind: string;
}

/**
 * DEMO MOCK -- staff pick their institution and enter a shared code. In production this is the
 * municipality's own staff identity system; see the note in src/server/session.ts.
 */
export function OperatorSignIn({ institutions }: { institutions: SelectableInstitution[] }) {
  const router = useRouter();
  const { t } = useTranslations();
  const [slug, setSlug] = useState(institutions[0]?.slug ?? "");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/institution/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionSlug: slug, pin }),
      });
      const data = (await response.json()) as { ok: true } | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.auth.couldNotSignIn);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-lg p-7">
      <h1 className="font-display text-2xl font-bold text-ink">{t.institution.signInTitle}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {t.institution.signInBody}
      </p>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink">{t.institution.whichInstitution}</legend>
        <div className="mt-3 grid gap-2">
          {institutions.map((institution) => (
            <label
              key={institution.slug}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                slug === institution.slug
                  ? "border-brand-500 bg-brand-100"
                  : "border-border-soft hover:bg-paper-sunk",
              )}
            >
              <input
                type="radio"
                name="institution"
                className="sr-only"
                checked={slug === institution.slug}
                onChange={() => setSlug(institution.slug)}
              />
              <span className="text-2xl" aria-hidden>
                {institution.emoji}
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{institution.name}</span>
                <span className="block text-xs text-ink-faint">
                  {institutionTypeLabel(institution.kind)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-6 block">
        <span className="text-sm font-semibold text-ink">{t.institution.staffCode}</span>
        <input
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder="••••"
          className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 text-sm focus:border-brand-500 focus:outline-none"
        />
      </label>

      {error ? <p className="mt-3 text-sm font-medium text-danger-700">{error}</p> : null}

      <Button className="mt-6 w-full" onClick={submit} disabled={busy || pin.length === 0}>
        {busy ? t.activities.checking : t.nav.signIn}
      </Button>

      <p className="mt-4 rounded-xl bg-sun-100 px-3 py-2 text-xs text-sun-700">
        {t.institution.demoStaffCode} <code className="font-mono font-semibold">1234</code>.
      </p>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useTranslations } from "@/features/i18n/LocaleProvider";

/** DEMO MOCK -- one shared code per business. See src/app/api/sponsor/session/route.ts. */
export function SponsorSignIn() {
  const router = useRouter();
  const { t } = useTranslations();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/sponsor/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code.trim() }),
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
    <Card className="mx-auto w-full max-w-md p-7">
      <span className="grid size-12 place-items-center rounded-2xl bg-sun-100 text-sun-700">
        <Store className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold text-ink">{t.sponsor.signInTitle}</h1>
      <p className="mt-2 text-sm text-ink-soft">{t.sponsor.signInBody}</p>

      <label className="mt-6 block">
        <span className="text-sm font-semibold text-ink">{t.sponsor.accessCode}</span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder="A1B2C3D4"
          className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 font-mono text-sm tracking-widest focus:border-brand-500 focus:outline-none"
        />
      </label>

      {error ? <p className="mt-3 text-sm font-medium text-danger-700">{error}</p> : null}

      <Button className="mt-6 w-full" onClick={submit} disabled={busy || code.trim().length === 0}>
        {busy ? t.activities.checking : t.nav.signIn}
      </Button>
    </Card>
  );
}

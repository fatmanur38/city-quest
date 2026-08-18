"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useTranslations } from "@/features/i18n/LocaleProvider";

/** DEMO MOCK — see the note in src/server/session.ts for the production replacement. */
export function AdminSignIn() {
  const router = useRouter();
  const { t } = useTranslations();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
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
      <h1 className="font-display text-2xl font-bold text-ink">{t.admin.signInTitle}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {t.admin.signInBody}
      </p>

      <label className="mt-6 block">
        <span className="text-sm font-semibold text-ink">{t.admin.adminCode}</span>
        <input
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 text-sm focus:border-brand-500 focus:outline-none"
        />
      </label>

      {error ? <p className="mt-3 text-sm font-medium text-danger-700">{error}</p> : null}

      <Button className="mt-6 w-full" onClick={submit} disabled={busy || pin.length === 0}>
        {busy ? t.activities.checking : t.nav.signIn}
      </Button>

      <p className="mt-4 rounded-xl bg-sun-100 px-3 py-2 text-xs text-sun-700">
        {t.admin.demoAdminCode} <code className="font-mono font-semibold">cityquest</code>.
      </p>
    </Card>
  );
}

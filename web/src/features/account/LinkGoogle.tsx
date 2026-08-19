"use client";

import { useState } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { authClient } from "@/lib/supabase/browser";
import { useTranslations } from "@/features/i18n/LocaleProvider";

/**
 * Rescuing a device account.
 *
 * Someone who tapped "continue without signing up" has real achievements bound to a key that
 * lives in one browser's local storage. Clearing site data loses it, and it does not follow them
 * to a second phone. This is where they can fix that, at any point, without starting over --
 * their Google identity is pointed at the account they already have, rather than opening a
 * second one.
 *
 * Deliberately not a banner or a modal: it is a real risk, but nagging someone about key
 * management on the screen that is meant to celebrate what they earned would be the wrong
 * trade. It sits below the achievements, stated once.
 */
export function LinkGoogle({ linked }: { linked: boolean }) {
  const { t } = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (linked) {
    return (
      <Card className="mt-6 flex items-start gap-3 p-5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden />
        <div>
          <p className="font-semibold text-ink">{t.account.googleLinkedTitle}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.account.googleLinkedBody}</p>
        </div>
      </Card>
    );
  }

  async function link() {
    setBusy(true);
    setError(null);
    try {
      const { error: oauthError } = await authClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?intent=link&next=%2Faccount`,
        },
      });
      if (oauthError) throw oauthError;
    } catch {
      setError(t.common.couldNotReach);
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 p-5">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-sun-700" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-ink">{t.account.linkGoogleTitle}</p>
          <p className="mt-1 text-sm text-ink-soft">{t.account.linkGoogleBody}</p>
        </div>
      </div>
      <Button variant="secondary" size="md" className="mt-4" disabled={busy} onClick={link}>
        {busy ? t.auth.settingUp : t.account.linkGoogleButton}
      </Button>
      {error ? <p className="mt-3 text-xs font-medium text-danger-700">{error}</p> : null}
    </Card>
  );
}

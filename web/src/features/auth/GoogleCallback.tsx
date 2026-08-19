"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/supabase/browser";
import { useTranslations } from "@/features/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/Icon";

/**
 * Where Google sends everyone back to.
 *
 * Nothing here is a decision the citizen makes, so the screen says what is happening and then
 * gets out of the way. It only becomes interactive if something failed, because a dead end with
 * no way forward is the one thing this page must never be.
 */
export function GoogleCallback({
  redirectTo,
  intent,
}: {
  redirectTo: string;
  /** "link" attaches Google to the account already signed in; "signin" opens one. */
  intent: "signin" | "link";
}) {
  const router = useRouter();
  const { t } = useTranslations();
  const [error, setError] = useState<string | null>(null);
  // React runs effects twice in development. Exchanging a PKCE code twice fails the second
  // time, which would show an error on a sign-in that actually succeeded.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (!code) throw new Error(t.auth.couldNotSignIn);

        const { data, error: exchangeError } = await authClient().auth.exchangeCodeForSession(code);
        if (exchangeError || !data.session) throw new Error(t.auth.couldNotSignIn);

        const endpoint = intent === "link" ? "/api/auth/link/google" : "/api/auth/google";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: data.session.access_token }),
        });
        const result = (await response.json()) as { ok: boolean; error?: string };
        if (!result.ok) throw new Error(result.error ?? t.auth.couldNotSignIn);

        // Supabase has done its job. Keeping its session around would leave a second, parallel
        // notion of "signed in" that nothing else in the app consults.
        await authClient().auth.signOut();

        router.replace(redirectTo);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : t.common.couldNotReach);
      }
    })();
  }, [router, redirectTo, intent, t]);

  return (
    <div className="mx-auto grid w-full max-w-md place-items-center px-4 py-24 text-center">
      {error ? (
        <>
          <IconTile name="compass" tone="danger" size="hero" />
          <h1 className="mt-6 font-display text-2xl font-bold text-ink">{t.auth.couldNotSignIn}</h1>
          <p className="mt-3 text-sm text-ink-soft">{error}</p>
          <Button className="mt-8" onClick={() => router.push("/")}>
            {t.auth.backHome}
          </Button>
        </>
      ) : (
        <>
          <IconTile name="landmark" tone="brand" size="hero" className="animate-pulse" />
          <h1 className="mt-6 font-display text-2xl font-bold text-ink">
            {intent === "link" ? t.account.linking : t.auth.finishing}
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            {intent === "link" ? t.account.linkingBody : t.auth.finishingBody}
          </p>
        </>
      )}
    </div>
  );
}

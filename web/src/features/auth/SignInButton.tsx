"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { hasBrowserWallet } from "./wallet";
import { useAccount } from "./AccountProvider";
import { authClient, googleSignInAvailable } from "@/lib/supabase/browser";
import { useTranslations } from "@/features/i18n/LocaleProvider";

/** Google's mark. Inlined because their brand guidelines require these exact four colours. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * "Create my City Account", not "Connect Wallet".
 *
 * Three ways in, in the order most people should take them. Google first, because it is the
 * only one that survives a lost phone or a cleared browser -- and because it is the sign-in
 * everybody already knows. The device account stays as the no-account-needed path. A browser
 * wallet appears only for people who already have one and would rather use it.
 *
 * The word "wallet" appears exactly once on this screen, in the option written for the people
 * who were looking for it.
 */
export function SignInButton({
  label,
  redirectTo = "/account",
  size = "lg",
}: {
  label?: string;
  redirectTo?: string;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const { status, busy, error, signIn } = useAccount();
  const { t } = useTranslations();
  const text = label ?? t.auth.start;

  // Whether this deployment configured Google is a build-time constant -- Next inlines the
  // NEXT_PUBLIC_ values -- so it renders the same on the server and on the client. Deciding it
  // in an effect instead would paint the device button as the primary call to action and then
  // demote it a frame later, which is a visible jump on the one screen that has to feel solid.
  const showGoogle = googleSignInAvailable();

  // Whether a wallet extension exists genuinely is not knowable until the browser runs, so this
  // one has to wait for mount.
  const [showWalletOption, setShowWalletOption] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => setShowWalletOption(hasBrowserWallet()), []);

  if (status === "signed-in") {
    return (
      <Button size={size} onClick={() => router.push(redirectTo)}>
        {t.auth.openAccount}
      </Button>
    );
  }

  async function continueWithGoogle() {
    setRedirecting(true);
    setGoogleError(null);
    try {
      const next = encodeURIComponent(redirectTo);
      const { error: oauthError } = await authClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${next}` },
      });
      if (oauthError) throw oauthError;
    } catch {
      setGoogleError(t.auth.couldNotSignIn);
      setRedirecting(false);
    }
  }

  const disabled = busy || redirecting;

  return (
    <div className="flex w-full max-w-xs min-w-0 flex-col items-stretch gap-3">
      {showGoogle ? (
        <>
          <Button
            size={size}
            variant="secondary"
            disabled={disabled}
            onClick={continueWithGoogle}
            className="gap-2.5"
          >
            <GoogleMark />
            {redirecting ? t.auth.settingUp : t.auth.withGoogle}
          </Button>
          <p className="text-center text-xs text-ink-faint">{t.auth.withGoogleWhy}</p>

          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-border-soft" />
            <span className="text-[0.7rem] font-medium tracking-wide text-ink-faint uppercase">
              {t.auth.or}
            </span>
            <span className="h-px flex-1 bg-border-soft" />
          </div>
        </>
      ) : null}

      <Button
        size={size}
        variant={showGoogle ? "ghost" : "primary"}
        disabled={disabled}
        onClick={async () => {
          await signIn("device");
          router.push(redirectTo);
        }}
      >
        {busy ? t.auth.settingUp : showGoogle ? t.auth.withoutAccount : text}
      </Button>

      <p className="text-center text-xs text-ink-faint">
        {showGoogle ? t.auth.withoutAccountWhy : t.auth.reassurance}
      </p>

      {showWalletOption ? (
        <button
          type="button"
          className="text-center text-xs font-medium text-ink-soft underline underline-offset-2 hover:text-ink"
          disabled={disabled}
          onClick={async () => {
            await signIn("browser");
            router.push(redirectTo);
          }}
        >
          {t.auth.haveWallet}
        </button>
      ) : null}

      {error || googleError ? (
        <p className="text-center text-xs font-medium text-danger-700">{error ?? googleError}</p>
      ) : null}
    </div>
  );
}

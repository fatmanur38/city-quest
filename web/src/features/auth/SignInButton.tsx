"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { hasBrowserWallet } from "./wallet";
import { useAccount } from "./AccountProvider";
import { useTranslations } from "@/features/i18n/LocaleProvider";

/**
 * "Create my City Account", not "Connect Wallet".
 *
 * The default path creates an identity on the device with a single tap. People who already own
 * a wallet get a quieter second option; nobody is required to know what a wallet is.
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
  const [showWalletOption, setShowWalletOption] = useState(false);

  useEffect(() => setShowWalletOption(hasBrowserWallet()), []);

  if (status === "signed-in") {
    return (
      <Button size={size} onClick={() => router.push(redirectTo)}>
        {t.auth.openAccount}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        size={size}
        disabled={busy}
        onClick={async () => {
          await signIn("device");
          router.push(redirectTo);
        }}
      >
        {busy ? t.auth.settingUp : text}
      </Button>

      <p className="text-xs text-ink-faint">
        {t.auth.reassurance}
      </p>

      {showWalletOption ? (
        <button
          type="button"
          className="text-xs font-medium text-ink-soft underline underline-offset-2 hover:text-ink"
          disabled={busy}
          onClick={async () => {
            await signIn("browser");
            router.push(redirectTo);
          }}
        >
          {t.auth.haveWallet}
        </button>
      ) : null}

      {error ? <p className="text-xs font-medium text-danger-700">{error}</p> : null}
    </div>
  );
}

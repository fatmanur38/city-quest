"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TechnicalDetails } from "@/components/ui/TechnicalDetails";
import { useAccount } from "@/features/auth/AccountProvider";
import { explorerTxUrl } from "@/lib/chain/client";
import { useTranslations } from "@/features/i18n/LocaleProvider";

interface ClaimResponse {
  ok: true;
  credential: { title: string; emoji: string };
  issuer: string;
  xpAwarded: number;
  txHash: string;
}

/**
 * Claiming a quest reward.
 *
 * The server does not take our word for the prerequisites -- it reads the library's and the
 * science center's credentials off the shared registry before the municipality will sign
 * anything. That check is the whole point of the quest.
 */
export function ClaimQuestButton({
  questSlug,
  disabled,
  rewardTitle,
}: {
  questSlug: string;
  disabled: boolean;
  rewardTitle: string;
}) {
  const router = useRouter();
  const { status, signIn } = useAccount();
  const { t } = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimResponse | null>(null);

  if (status !== "signed-in") {
    return (
      <Button variant="secondary" onClick={() => signIn()}>
        {t.auth.signInToClaim}
      </Button>
    );
  }

  if (result) {
    return (
      <div className="animate-pop rounded-2xl bg-sun-100 p-5">
        <p className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <span className="text-2xl" aria-hidden>
            {result.credential.emoji}
          </span>
          {t.quests.added(result.credential.title)}
        </p>
        <p className="mt-1 text-sm text-sun-700">
          {t.quests.confirmedBy(result.issuer, result.xpAwarded)}
        </p>
        <TechnicalDetails
          className="mt-3"
          txHash={result.txHash}
          explorerUrl={explorerTxUrl(result.txHash)}
        />
      </div>
    );
  }

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questSlug }),
      });
      const data = (await response.json()) as ClaimResponse | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      setResult(data);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The reward could not be claimed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button onClick={claim} disabled={disabled || busy} className="gap-2">
        <Trophy className="size-4" aria-hidden />
        {busy ? t.quests.confirming : t.quests.claim(rewardTitle)}
      </Button>
      {disabled ? (
        <p className="mt-2 text-xs text-ink-faint">
          {t.quests.finishFirst}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm font-medium text-danger-700">{error}</p> : null}
    </div>
  );
}

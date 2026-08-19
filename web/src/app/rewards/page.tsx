import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SignInButton } from "@/features/auth/SignInButton";
import { ClaimRewardButton } from "@/features/rewards/ClaimRewardButton";
import { ShieldCheck, Sparkles } from "lucide-react";
import { currentWallet } from "@/server/session";
import { loadRewardsFor } from "@/server/rewards";
import { getTranslations } from "@/server/locale";

export async function generateMetadata() {
  const { t } = await getTranslations();
  return { title: `${t.rewards.metaTitle} — CityQuest` };
}

export default async function RewardsPage() {
  const [wallet, { locale, t }] = await Promise.all([currentWallet(), getTranslations()]);
  const rewards = await loadRewardsFor(wallet, locale);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {t.rewards.title}
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">{t.rewards.lead}</p>
      </header>

      <div className="mt-9 grid gap-5 sm:grid-cols-2">
        {rewards.map((reward) => (
          <Card key={reward.slug} className="flex flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-14 place-items-center rounded-2xl bg-sun-100 text-3xl">
                {reward.emoji}
              </span>
              {reward.eligible ? (
                <Badge tone="emerald">{t.rewards.eligible}</Badge>
              ) : (
                <Badge tone="neutral">{t.rewards.locked}</Badge>
              )}
            </div>

            <h2 className="mt-4 font-display text-lg font-bold text-ink">{reward.title}</h2>
            <p className="mt-1 text-sm font-semibold text-ink-soft">
              {t.rewards.by(reward.sponsorName)}
            </p>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">
              {reward.description}
            </p>

            <div className="mt-4 rounded-xl bg-paper-sunk px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
                {t.rewards.requirement}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">{reward.requirementLabel}</p>

              {reward.progress ? (
                <p className="mt-1 text-xs text-ink-faint">
                  {t.rewards.progress(reward.progress.done, reward.progress.total)}
                </p>
              ) : null}

              {/*
               * The distinction that matters, said out loud: an on-chain achievement is one the
               * business could verify without us, a visit count is one it is trusting us for.
               */}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
                {reward.verification === "chain" ? (
                  <ShieldCheck className="size-3.5 shrink-0 text-brand-700" aria-hidden />
                ) : (
                  <Sparkles className="size-3.5 shrink-0 text-sun-700" aria-hidden />
                )}
                {reward.verification === "chain"
                  ? t.sponsor.verifiedOnChain
                  : t.sponsor.countedByApp}
              </p>
            </div>

            <div className="mt-5">
              {!wallet ? (
                <SignInButton label={t.auth.signInToCheck} redirectTo="/rewards" size="md" />
              ) : (
                <ClaimRewardButton
                  rewardSlug={reward.slug}
                  eligible={reward.eligible}
                  existingCode={reward.couponCode}
                  requirement={reward.requirementLabel}
                />
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 bg-paper-sunk/50 p-6">
        <h2 className="font-display text-base font-semibold text-ink">{t.rewards.whyTitle}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">{t.rewards.whyBody}</p>
      </Card>
    </div>
  );
}

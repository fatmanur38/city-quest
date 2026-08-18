import { BadgeCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { currentWallet } from "@/server/session";
import { loadPassport } from "@/server/passport-service";
import { QUESTS, institutionBySlug } from "@/server/catalog";
import { CREDENTIALS } from "@/lib/credentials";
import { ClaimQuestButton } from "@/features/quests/ClaimQuestButton";
import { SignInButton } from "@/features/auth/SignInButton";
import { getTranslations } from "@/server/locale";
import { pick } from "@/lib/i18n/types";

export async function generateMetadata() {
  const { t } = await getTranslations();
  return { title: `${t.quests.metaTitle} — CityQuest` };
}

export default async function QuestsPage() {
  const [wallet, { locale, t }] = await Promise.all([currentWallet(), getTranslations()]);
  const passport = wallet ? await loadPassport(wallet) : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {t.quests.title}
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          {t.quests.lead}
        </p>
      </header>

      <div className="mt-9 space-y-6">
        {QUESTS.map((quest) => {
          const progress = passport?.quests.find((entry) => entry.quest.slug === quest.slug);
          const issuer = institutionBySlug(quest.issuerSlug);
          const reward = CREDENTIALS[quest.rewardCredential];
          const requirements =
            progress?.requirements ??
            quest.requirements.map((requirement) => ({
              label: requirement.label,
              met: false,
              verifiedOnChain: requirement.kind === "credential",
            }));
          const completed = requirements.filter((requirement) => requirement.met).length;

          return (
            <Card key={quest.slug} className="overflow-hidden">
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sun-100 text-3xl">
                      {quest.emoji}
                    </span>
                    <div>
                      <h2 className="font-display text-xl font-bold text-ink">
                        {pick(quest.title, locale)}
                      </h2>
                      <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
                        {pick(quest.description, locale)}
                      </p>
                    </div>
                  </div>

                  {progress?.claimed ? <Badge tone="emerald">{t.quests.earned}</Badge> : null}
                </div>

                {/* Progress */}
                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink">
                      {t.quests.complete(completed, requirements.length)}
                    </span>
                    <span className="text-ink-faint">
                      {Math.round((completed / requirements.length) * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-paper-sunk">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-[width]"
                      style={{ width: `${(completed / requirements.length) * 100}%` }}
                    />
                  </div>
                </div>

                <ul className="mt-6 space-y-3">
                  {requirements.map((requirement) => (
                    <li
                      key={pick(requirement.label, locale)}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl bg-paper-sunk/60 px-4 py-3"
                    >
                      <span className="text-lg" aria-hidden>
                        {requirement.met ? "✅" : "⭕"}
                      </span>
                      <span
                        className={`flex-1 text-sm font-medium ${
                          requirement.met ? "text-ink" : "text-ink-soft"
                        }`}
                      >
                        {pick(requirement.label, locale)}
                      </span>
                      {requirement.verifiedOnChain ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                          <BadgeCheck className="size-3.5" aria-hidden />
                          {t.quests.confirmedByInstitution}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-faint">
                          <Sparkles className="size-3.5" aria-hidden />
                          {t.quests.scoredByApp}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Reward */}
                <div className="mt-6 rounded-2xl border border-sun-300/60 bg-sun-100/50 p-5">
                  <p className="text-xs font-semibold tracking-wide text-sun-700 uppercase">
                    {t.quests.reward}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-3xl" aria-hidden>
                      {reward.emoji}
                    </span>
                    <div>
                      <p className="font-display text-base font-bold text-ink">
                        {pick(reward.title, locale)}
                      </p>
                      <p className="text-sm text-ink-soft">
                        {t.quests.issuedBy(
                          issuer ? pick(issuer.label, locale) : "",
                          quest.xpReward,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    {!wallet ? (
                      <SignInButton label={t.auth.startShort} redirectTo="/quests" size="md" />
                    ) : progress?.claimed ? (
                      <p className="text-sm font-semibold text-emerald-500">
                        {t.quests.alreadyInPassport}
                      </p>
                    ) : (
                      <ClaimQuestButton
                        questSlug={quest.slug}
                        disabled={!progress?.allMet}
                        rewardTitle={pick(reward.title, locale)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

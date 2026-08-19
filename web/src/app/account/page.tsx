import Link from "next/link";
import { Flame, Sparkles, Ticket, Trophy } from "lucide-react";
import { currentWallet } from "@/server/session";
import { loadAccount } from "@/server/account-service";
import { Card, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { AppAwardedMark } from "@/components/ui/VerifiedMark";
import { SignInButton } from "@/features/auth/SignInButton";
import { AccountCode } from "@/features/account/AccountCode";
import { LinkGoogle } from "@/features/account/LinkGoogle";
import { CredentialCard } from "@/features/account/CredentialCard";
import { activityBySlug } from "@/server/catalog";
import { isChainConfigured } from "@/lib/env";
import { googleConfigured, googleLinkedFor } from "@/server/google";
import { getTranslations } from "@/server/locale";
import { pick } from "@/lib/i18n/types";
import { IconTile } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Circle, CircleCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";



export async function generateMetadata() {
  const { t } = await getTranslations();
  return { title: `${t.account.metaTitle} — CityQuest` };
}

export default async function AccountPage() {
  const [wallet, { locale, t }] = await Promise.all([currentWallet(), getTranslations()]);

  if (!wallet) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon="compass"
          tone="brand"
          title={t.account.signedOutTitle}
          body={t.account.signedOutBody}
          action={<SignInButton />}
        />
      </div>
    );
  }

  const [account, googleLinked] = await Promise.all([loadAccount(wallet), googleLinkedFor(wallet)]);
  const { profile, level, credentials, passes, completions, quests, libraryStreakDays } = account;
  const validPasses = passes.filter((pass) => pass.status === "Valid");
  const activeQuest = quests.find((quest) => !quest.claimed) ?? quests[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      {/* --------------------------------------------------------------- Account header */}
      <Card className="overflow-hidden">
        <div className="perforation h-2.5 w-full" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <Avatar address={profile.wallet} className="size-16 shrink-0" />
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">
                  {t.account.documentLabel}
                </p>
                <h1 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                  {profile.displayName}
                </h1>
              </div>
            </div>

            <AccountCode wallet={wallet} />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-brand-100 p-4">
              <p className="text-xs font-semibold text-brand-700">{t.common.level}</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-brand-900">
                {level.level}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-300/40">
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{ width: `${Math.round(level.progress * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-brand-700">
                {t.account.toNextLevel(level.xpForNextLevel - level.xpIntoLevel, level.level + 1)}
              </p>
            </div>

            <div className="rounded-2xl bg-paper-sunk p-4">
              <p className="text-xs font-semibold text-ink-soft">{t.account.experience}</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-ink">{profile.xp}</p>
              <div className="mt-3">
                <AppAwardedMark label={t.common.appPoints} />
              </div>
            </div>

            <div className="rounded-2xl bg-sun-100 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-sun-700">
                <Flame className="size-3.5" aria-hidden />
                {t.account.libraryStreak}
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold text-sun-700">
                {libraryStreakDays}
              </p>
              <p className="mt-3 text-xs text-sun-700">
                {libraryStreakDays === 0
                  ? t.account.streakNone
                  : t.account.streakDays(libraryStreakDays)}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {!isChainConfigured ? (
        <Card className="mt-6 border-danger-100 bg-danger-100/30 p-4 text-sm text-danger-700">
          {t.account.chainNotConfigured}
        </Card>
      ) : null}

      {/* ---------------------------------------------------------------- Achievements */}
      <section className="mt-10">
        <CardHeader
          title={t.account.achievements}
          description={t.account.achievementsLead}
        />

        {credentials.length === 0 ? (
          <Card className="mt-4">
            <EmptyState
              icon="leaf"
              tone="emerald"
              title={t.account.noAchievements}
              body={t.account.noAchievementsBody}
              action={<ButtonLink href="/activities">{t.account.findSomething}</ButtonLink>}
            />
          </Card>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {credentials.map((credential) => (
              <CredentialCard key={credential.hash} credential={credential} locale={locale} t={t} />
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------------- Quest */}
      {activeQuest ? (
        <section className="mt-12">
          <CardHeader title={t.account.currentQuest} description={t.account.currentQuestLead} />
          <Card className="mt-4 p-6">
            <div className="flex items-start gap-4">
              <IconTile name={activeQuest.quest.icon} tone="sun" size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold text-ink">
                  {pick(activeQuest.quest.title, locale)}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {pick(activeQuest.quest.description, locale)}
                </p>

                <ul className="mt-4 space-y-2">
                  {activeQuest.requirements.map((requirement) => (
                    <li key={pick(requirement.label, locale)} className="flex items-center gap-2.5 text-sm">
                      {requirement.met ? (
                        <CircleCheck className="size-4 shrink-0 text-emerald-500" aria-hidden />
                      ) : (
                        <Circle className="size-4 shrink-0 text-ink-faint" aria-hidden />
                      )}
                      <span className={requirement.met ? "text-ink" : "text-ink-soft"}>
                        {pick(requirement.label, locale)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex items-center gap-3">
                  <ButtonLink href="/quests" variant={activeQuest.allMet ? "primary" : "secondary"}>
                    {activeQuest.claimed
                      ? t.account.viewQuests
                      : activeQuest.allMet
                        ? t.account.claimReward
                        : t.account.questDetails}
                  </ButtonLink>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
                    <Trophy className="size-4" aria-hidden />
                    {t.account.questProgress(activeQuest.completed, activeQuest.total)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      {/* -------------------------------------------------------------------- Tickets */}
      {validPasses.length > 0 ? (
        <section className="mt-12">
          <CardHeader title={t.account.yourTickets} description={t.account.yourTicketsLead} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {validPasses.map((pass) => (
              <Link key={pass.passId} href="/tickets">
                <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-lift">
                  <IconTile name={pass.credential.icon} tone="violet" size="md" />
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-ink">
                      {pick(pass.credential.title, locale)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                      <Ticket className="size-3.5" aria-hidden />
                      {t.tickets.ticketNumber(pass.passId)} · {t.tickets.statusValid}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------------------------- History */}
      {completions.length > 0 ? (
        <section className="mt-12">
          <CardHeader
            title={t.account.recentActivity}
            description={t.account.recentActivityLead}
          />
          <Card className="mt-4 divide-y divide-border-soft">
            {completions.slice(0, 8).map((completion) => {
              const activity = activityBySlug(completion.activitySlug);
              const isQuest = completion.activitySlug.startsWith("quest:");
              return (
                <div key={completion.id} className="flex items-center gap-3 p-4">
                  <IconTile
                    name={isQuest ? "trophy" : (activity?.icon ?? "sparkles")}
                    tone={isQuest ? "sun" : "neutral"}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {isQuest
                        ? t.account.questCompleted
                        : activity
                          ? pick(activity.title, locale)
                          : completion.activitySlug}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {new Date(completion.createdAt).toLocaleDateString(
                        locale === "tr" ? "tr-TR" : "en-GB",
                        {
                          day: "numeric",
                          month: "short",
                        },
                      )}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-brand-700">
                    <Sparkles className="size-3.5" aria-hidden />+{completion.xpAwarded}
                  </span>
                </div>
              );
            })}
          </Card>
        </section>
      ) : null}

      {googleConfigured() ? <LinkGoogle linked={googleLinked} /> : null}
    </div>
  );
}

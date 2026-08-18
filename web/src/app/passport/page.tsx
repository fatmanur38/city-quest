import Link from "next/link";
import { Flame, Sparkles, Ticket, Trophy } from "lucide-react";
import { currentWallet } from "@/server/session";
import { loadPassport } from "@/server/passport-service";
import { Card, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { AppAwardedMark } from "@/components/ui/VerifiedMark";
import { SignInButton } from "@/features/auth/SignInButton";
import { PassportCode } from "@/features/passport/PassportCode";
import { CredentialCard } from "@/features/passport/CredentialCard";
import { activityBySlug } from "@/server/catalog";
import { isChainConfigured } from "@/lib/env";

export const metadata = { title: "My City Passport — CityQuest" };

export default async function PassportPage() {
  const wallet = await currentWallet();

  if (!wallet) {
    return (
      <div className="mx-auto grid w-full max-w-2xl place-items-center px-4 py-24 text-center sm:px-6">
        <span className="text-6xl">🛂</span>
        <h1 className="mt-6 font-display text-3xl font-bold text-ink">Your passport is waiting</h1>
        <p className="mt-3 text-ink-soft">
          Create one in a single tap. Nothing to install, nothing to pay.
        </p>
        <div className="mt-8 flex justify-center">
          <SignInButton />
        </div>
      </div>
    );
  }

  const passport = await loadPassport(wallet);
  const { profile, level, credentials, passes, completions, quests, libraryStreakDays } = passport;
  const validPasses = passes.filter((pass) => pass.status === "Valid");
  const activeQuest = quests.find((quest) => !quest.claimed) ?? quests[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      {/* ------------------------------------------------------------- Passport header */}
      <Card className="overflow-hidden">
        <div className="perforation h-2.5 w-full" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="grid size-16 place-items-center rounded-2xl bg-paper-sunk text-4xl">
                {profile.avatarEmoji}
              </span>
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">
                  City Learning Passport
                </p>
                <h1 className="mt-1 font-display text-2xl font-extrabold text-ink sm:text-3xl">
                  {profile.displayName}
                </h1>
              </div>
            </div>

            <PassportCode wallet={wallet} />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-brand-100 p-4">
              <p className="text-xs font-semibold text-brand-700">Level</p>
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
                {level.xpForNextLevel - level.xpIntoLevel} XP to level {level.level + 1}
              </p>
            </div>

            <div className="rounded-2xl bg-paper-sunk p-4">
              <p className="text-xs font-semibold text-ink-soft">Experience</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-ink">{profile.xp}</p>
              <div className="mt-3">
                <AppAwardedMark />
              </div>
            </div>

            <div className="rounded-2xl bg-sun-100 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-sun-700">
                <Flame className="size-3.5" aria-hidden />
                Library streak
              </p>
              <p className="mt-1 font-display text-3xl font-extrabold text-sun-700">
                {libraryStreakDays}
              </p>
              <p className="mt-3 text-xs text-sun-700">
                {libraryStreakDays === 0
                  ? "Visit a library to start one"
                  : `${libraryStreakDays === 1 ? "day" : "days"} in a row`}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {!isChainConfigured ? (
        <Card className="mt-6 border-danger-100 bg-danger-100/30 p-4 text-sm text-danger-700">
          The city registry is not configured, so achievements cannot be shown. Check the contract
          addresses in <code className="font-mono">.env.local</code>.
        </Card>
      ) : null}

      {/* ---------------------------------------------------------------- Achievements */}
      <section className="mt-10">
        <CardHeader
          title="Achievements"
          description="Each one was confirmed by the institution named on it."
        />

        {credentials.length === 0 ? (
          <Card className="mt-4 grid place-items-center p-10 text-center">
            <span className="text-5xl">🌱</span>
            <p className="mt-4 font-display text-lg font-semibold text-ink">
              No achievements yet
            </p>
            <p className="mt-2 max-w-sm text-sm text-ink-soft">
              Visit a library, a museum or the science center and ask them to confirm your visit.
            </p>
            <ButtonLink href="/activities" className="mt-6">
              Find something to do
            </ButtonLink>
          </Card>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {credentials.map((credential) => (
              <CredentialCard key={credential.hash} credential={credential} />
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------------- Quest */}
      {activeQuest ? (
        <section className="mt-12">
          <CardHeader title="Current quest" description="Combine achievements to earn a bigger one." />
          <Card className="mt-4 p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sun-100 text-3xl">
                {activeQuest.quest.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold text-ink">
                  {activeQuest.quest.title}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">{activeQuest.quest.description}</p>

                <ul className="mt-4 space-y-2">
                  {activeQuest.requirements.map((requirement) => (
                    <li key={requirement.label} className="flex items-center gap-2.5 text-sm">
                      <span aria-hidden>{requirement.met ? "✅" : "⭕"}</span>
                      <span className={requirement.met ? "text-ink" : "text-ink-soft"}>
                        {requirement.label}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex items-center gap-3">
                  <ButtonLink href="/quests" variant={activeQuest.allMet ? "primary" : "secondary"}>
                    {activeQuest.claimed
                      ? "View quests"
                      : activeQuest.allMet
                        ? "Claim your reward"
                        : "See quest details"}
                  </ButtonLink>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
                    <Trophy className="size-4" aria-hidden />
                    {activeQuest.completed}/{activeQuest.total} done
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
          <CardHeader title="Your tickets" description="Show these at the entrance." />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {validPasses.map((pass) => (
              <Link key={pass.passId} href="/tickets">
                <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-lift">
                  <span className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-2xl">
                    {pass.credential.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold text-ink">
                      {pass.credential.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                      <Ticket className="size-3.5" aria-hidden />
                      Ticket #{pass.passId} · Valid
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
            title="Recent activity"
            description="Only you can see this. It is stored in the city app, not on the public registry."
          />
          <Card className="mt-4 divide-y divide-border-soft">
            {completions.slice(0, 8).map((completion) => {
              const activity = activityBySlug(completion.activitySlug);
              const isQuest = completion.activitySlug.startsWith("quest:");
              return (
                <div key={completion.id} className="flex items-center gap-3 p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-paper-sunk text-lg">
                    {isQuest ? "🏆" : (activity?.emoji ?? "✨")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {isQuest ? "Quest completed" : (activity?.title ?? completion.activitySlug)}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {new Date(completion.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
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
    </div>
  );
}

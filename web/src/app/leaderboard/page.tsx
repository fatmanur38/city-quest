import { Flame, Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { AppAwardedMark } from "@/components/ui/VerifiedMark";
import { currentWallet } from "@/server/session";
import { db } from "@/server/db";
import { levelFor } from "@/server/passport-service";
import { cn } from "@/lib/cn";

export const metadata = { title: "Explorers — CityQuest" };

const PODIUM = ["🥇", "🥈", "🥉"];

/**
 * The leaderboard.
 *
 * Deliberately built from the database and labelled as app points, not as verified achievements.
 * Ranking people by institutional credentials would turn "which institutions vouched for you"
 * into a competition, and that is the one number in this product that should never be a score.
 *
 * It shows a chosen display name and an emoji. No wallet addresses, no achievement lists, and
 * nothing that identifies a child — a public ranking is exactly the wrong place for any of that.
 */
export default async function LeaderboardPage() {
  const wallet = await currentWallet();
  const explorers = await db().leaderboard(25);
  const myWallet = wallet?.toLowerCase();
  const myRank = explorers.findIndex((profile) => profile.wallet === myWallet);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          City explorers
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Who has been out exploring this season. These are experience points from the city app —
          the achievements themselves are not a competition.
        </p>
        <div className="mt-4">
          <AppAwardedMark />
        </div>
      </header>

      {explorers.length === 0 ? (
        <Card className="mt-9 grid place-items-center p-12 text-center">
          <span className="text-5xl">🗺️</span>
          <p className="mt-4 font-display text-lg font-semibold text-ink">Nobody has set off yet</p>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">
            Be the first. Visit a library and get your passport stamped.
          </p>
          <ButtonLink href="/activities" className="mt-6">
            Find something to do
          </ButtonLink>
        </Card>
      ) : (
        <Card className="mt-9 divide-y divide-border-soft">
          {explorers.map((profile, index) => {
            const isMe = profile.wallet === myWallet;
            const level = levelFor(profile.xp);

            return (
              <div
                key={profile.wallet}
                className={cn(
                  "flex items-center gap-4 p-4",
                  isMe && "bg-brand-100/60",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center text-lg font-bold",
                    index > 2 && "font-display text-sm text-ink-faint",
                  )}
                >
                  {PODIUM[index] ?? index + 1}
                </span>

                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-paper-sunk text-2xl">
                  {profile.avatarEmoji}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 truncate font-semibold text-ink">
                    {profile.displayName}
                    {isMe ? <Badge tone="brand">You</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">Level {level.level}</p>
                </div>

                <span className="flex shrink-0 items-center gap-1.5 font-display text-lg font-bold text-brand-700">
                  <Trophy className="size-4" aria-hidden />
                  {profile.xp}
                </span>
              </div>
            );
          })}
        </Card>
      )}

      {wallet && myRank === -1 ? (
        <Card className="mt-5 flex items-center gap-3 p-5">
          <Flame className="size-5 shrink-0 text-sun-500" aria-hidden />
          <p className="text-sm text-ink-soft">
            You are not in the top 25 yet. Every verified visit moves you up.
          </p>
        </Card>
      ) : null}

      <p className="mt-8 text-sm leading-relaxed text-ink-soft">
        Points measure how much you have been out and about. They are not transferable, cannot be
        bought, and are worth nothing to anyone but you.
      </p>
    </div>
  );
}

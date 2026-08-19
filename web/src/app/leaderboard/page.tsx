import { Flame, Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { AppAwardedMark } from "@/components/ui/VerifiedMark";
import { currentWallet } from "@/server/session";
import { db } from "@/server/db";
import { levelFor } from "@/server/account-service";
import { cn } from "@/lib/cn";
import { getTranslations } from "@/server/locale";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";

export async function generateMetadata() {
  const { t } = await getTranslations();
  return { title: `${t.leaderboard.metaTitle} — CityQuest` };
}

/** Gold, silver, bronze -- as ring colours rather than as three medal emoji. */
const PODIUM_RING = [
  "bg-sun-100 text-sun-700 ring-sun-500/30",
  "bg-paper-sunk text-ink-soft ring-border-soft",
  "bg-berry-100 text-berry-500 ring-berry-500/25",
];

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
  const [wallet, { t }] = await Promise.all([currentWallet(), getTranslations()]);
  const explorers = await db().leaderboard(25);
  const myWallet = wallet?.toLowerCase();
  const myRank = explorers.findIndex((profile) => profile.wallet === myWallet);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {t.leaderboard.title}
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          {t.leaderboard.lead}
        </p>
        <div className="mt-4">
          <AppAwardedMark label={t.common.appPoints} />
        </div>
      </header>

      {explorers.length === 0 ? (
        <Card className="mt-9">
          <EmptyState
            icon="compass"
            tone="sky"
            title={t.leaderboard.empty}
            body={t.leaderboard.emptyBody}
            action={<ButtonLink href="/activities">{t.account.findSomething}</ButtonLink>}
          />
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
                    "grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold tabular-nums ring-1 ring-inset",
                    PODIUM_RING[index] ?? "text-ink-faint ring-transparent",
                  )}
                >
                  {index + 1}
                </span>

                <Avatar address={profile.wallet} className="size-11 shrink-0" />

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 truncate font-semibold text-ink">
                    {profile.displayName}
                    {isMe ? <Badge tone="brand">{t.leaderboard.you}</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {t.common.level} {level.level}
                  </p>
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
            {t.leaderboard.notInTop}
          </p>
        </Card>
      ) : null}

      <p className="mt-8 text-sm leading-relaxed text-ink-soft">
        {t.leaderboard.footnote}
      </p>
    </div>
  );
}

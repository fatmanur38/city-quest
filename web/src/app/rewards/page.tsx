import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SignInButton } from "@/features/auth/SignInButton";
import { ClaimRewardButton } from "@/features/rewards/ClaimRewardButton";
import { currentWallet } from "@/server/session";
import { loadPassport } from "@/server/passport-service";
import { REWARDS } from "@/server/catalog";
import { CREDENTIALS } from "@/lib/credentials";

export const metadata = { title: "Rewards — CityQuest" };

export default async function RewardsPage() {
  const wallet = await currentWallet();
  const passport = wallet ? await loadPassport(wallet) : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Rewards from local sponsors
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Local businesses offer small thank-yous to students who have earned particular
          achievements. They check your passport themselves — we do not sell them your details,
          and your points are never converted into money.
        </p>
      </header>

      <div className="mt-9 grid gap-5 sm:grid-cols-2">
        {REWARDS.map((reward) => {
          const view = passport?.rewards.find((entry) => entry.slug === reward.slug);
          const required = CREDENTIALS[reward.requiredCredential];

          return (
            <Card key={reward.slug} className="flex flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-14 place-items-center rounded-2xl bg-sun-100 text-3xl">
                  {reward.emoji}
                </span>
                {view?.eligible ? (
                  <Badge tone="emerald">Eligible</Badge>
                ) : (
                  <Badge tone="neutral">Locked</Badge>
                )}
              </div>

              <h2 className="mt-4 font-display text-lg font-bold text-ink">{reward.title}</h2>
              <p className="mt-1 text-sm font-semibold text-ink-soft">by {reward.sponsorName}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">
                {reward.description}
              </p>

              <div className="mt-4 rounded-xl bg-paper-sunk px-4 py-3">
                <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
                  Requirement
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {required.emoji} {required.title}
                </p>
              </div>

              <div className="mt-5">
                {!wallet ? (
                  <SignInButton label="Sign in to check" redirectTo="/rewards" size="md" />
                ) : (
                  <ClaimRewardButton
                    rewardSlug={reward.slug}
                    eligible={Boolean(view?.eligible)}
                    existingCode={view?.couponCode ?? null}
                    requirement={required.title}
                  />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8 bg-paper-sunk/50 p-6">
        <h2 className="font-display text-base font-semibold text-ink">
          Why a coupon and not a coin?
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
          The moment learning points become tradable, the incentive changes from &ldquo;go and
          learn something&rdquo; to &ldquo;farm the points&rdquo;. So the cafe reads an achievement
          it did not issue, decides for itself that it is worth a hot chocolate, and hands over an
          ordinary coupon. Nothing is bought, sold or transferred.
        </p>
      </Card>
    </div>
  );
}

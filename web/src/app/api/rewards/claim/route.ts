import { z } from "zod";
import { randomBytes } from "node:crypto";
import { fail, handle, ok, parseBody } from "@/server/api";
import { requireWallet } from "@/server/session";
import { rewardBySlug } from "@/server/catalog";
import { CREDENTIALS } from "@/lib/credentials";
import { hasCredential } from "@/lib/chain/reads";
import { db } from "@/server/db";

/**
 * A sponsor rewards verified learning with an ordinary coupon.
 *
 * Note what does not happen: no token is minted, nothing is transferred, and no exchange rate
 * exists between achievements and money. The cafe reads a credential it did not issue, decides
 * for itself that it is worth a hot chocolate, and hands over a coupon code. Points never become
 * currency.
 */

const schema = z.object({
  rewardSlug: z.string().min(1),
});

function couponCode(): string {
  return `CQ-${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  return handle(async () => {
    const wallet = await requireWallet();
    const { rewardSlug } = await parseBody(request, schema);

    const reward = rewardBySlug(rewardSlug);
    if (!reward) return fail("We do not know that reward.", 404);

    const existing = await db().findRewardClaim(wallet, reward.slug);
    if (existing) {
      return ok({
        reward: { title: reward.title, sponsor: reward.sponsorName, emoji: reward.emoji },
        couponCode: existing.couponCode,
        alreadyClaimed: true,
      });
    }

    const required = CREDENTIALS[reward.requiredCredential];
    if (!(await hasCredential(wallet, required.hash))) {
      return fail(`You need the ${required.title} achievement first.`, 403, "NotEligible");
    }

    const claim = await db().createRewardClaim(wallet, reward.slug, couponCode());
    return ok({
      reward: { title: reward.title, sponsor: reward.sponsorName, emoji: reward.emoji },
      couponCode: claim.couponCode,
      alreadyClaimed: false,
    });
  });
}

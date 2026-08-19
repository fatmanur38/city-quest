import { z } from "zod";
import { randomBytes } from "node:crypto";
import { fail, handle, ok, parseBody } from "@/server/api";
import { requireWallet } from "@/server/session";
import { rewardBySlug } from "@/server/catalog";
import { CREDENTIALS } from "@/lib/credentials";
import { hasCredential } from "@/lib/chain/reads";
import { meetsRequirement, requirementLabel } from "@/server/rewards";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";
import { pick } from "@/lib/i18n/types";
import { getDictionary } from "@/lib/i18n/dictionary";

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
    const { locale, t } = await getTranslations();

    const reward = rewardBySlug(rewardSlug);

    // Not in the catalogue: it may be an offer a business published for itself.
    if (!reward) {
      const offer = await db().findSponsorOffer(rewardSlug);
      const sponsor = offer ? await db().findSponsor(offer.sponsorSlug) : null;

      // An offer that has been withdrawn, or whose business the municipality has not approved
      // (or has since removed), is treated as if it never existed. A coupon already granted
      // stays valid -- taking one back after the fact would be the city breaking a promise a
      // business made.
      if (!offer || !sponsor || !sponsor.approved || !offer.active) {
        const existingClaim = await db().findRewardClaim(wallet, rewardSlug);
        if (existingClaim && offer && sponsor) {
          return ok({
            reward: {
              title: offer.title,
              sponsor: sponsor.name,
              icon: offer.icon,
            },
            couponCode: existingClaim.couponCode,
            alreadyClaimed: true,
          });
        }
        return fail(t.errors.unknownReward, 404);
      }

      const claimed = await db().findRewardClaim(wallet, offer.slug);
      if (claimed) {
        return ok({
          reward: {
            title: offer.title,
            sponsor: sponsor.name,
            icon: offer.icon,
          },
          couponCode: claimed.couponCode,
          alreadyClaimed: true,
        });
      }

      if (!(await meetsRequirement(wallet, offer.requirement))) {
        return fail(
          getDictionary(locale).rewards.notYetBody(requirementLabel(offer.requirement, locale)),
          403,
          "NotEligible",
        );
      }

      const granted = await db().createRewardClaim(wallet, offer.slug, couponCode());
      return ok({
        reward: {
          title: offer.title,
          sponsor: sponsor.name,
          icon: offer.icon,
        },
        couponCode: granted.couponCode,
        alreadyClaimed: false,
      });
    }

    const existing = await db().findRewardClaim(wallet, reward.slug);
    if (existing) {
      return ok({
        reward: {
          title: pick(reward.title, locale),
          sponsor: reward.sponsorName,
          icon: reward.icon,
        },
        couponCode: existing.couponCode,
        alreadyClaimed: true,
      });
    }

    const required = CREDENTIALS[reward.requiredCredential];
    if (!(await hasCredential(wallet, required.hash))) {
      return fail(
        getDictionary(locale).rewards.notYetBody(pick(required.title, locale)),
        403,
        "NotEligible",
      );
    }

    const claim = await db().createRewardClaim(wallet, reward.slug, couponCode());
    return ok({
      reward: {
        title: pick(reward.title, locale),
        sponsor: reward.sponsorName,
        icon: reward.icon,
      },
      couponCode: claim.couponCode,
      alreadyClaimed: false,
    });
  });
}

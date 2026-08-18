import { z } from "zod";
import { getAddress } from "viem";
import { fail, handle, ok, parseBody } from "@/server/api";
import { requireOperator } from "@/server/session";
import { activityBySlug, institutionBySlug } from "@/server/catalog";
import { CREDENTIALS } from "@/lib/credentials";
import { periodIdFor, periodKeyFor } from "@/lib/period";
import { addressForSlug } from "@/server/institutions";
import { buildClaim, verifyActivityOnChain } from "@/server/chain/writes";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";
import { pick } from "@/lib/i18n/types";

/**
 * An institution confirms that a citizen was there.
 *
 * This is the heart of the product. The institution signs a claim naming the citizen, the
 * achievement and the day; a relayer submits it; the contract refuses it if this institution is
 * not authorised, if the signature is wrong, or if this exact person has already been verified
 * here today. Only after the chain accepts does the citizen get their points.
 */

const schema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "not a valid passport code"),
  activitySlug: z.string().min(1),
});

export async function POST(request: Request) {
  return handle(async () => {
    await requireOperator();
    const body = await parseBody(request, schema);
    const { locale } = await getTranslations();

    const activity = activityBySlug(body.activitySlug);
    if (!activity) return fail("We do not know that activity.", 404);
    if (!activity.credential) {
      return fail("That activity is not verified in person.", 400);
    }
    if (activity.kind === "ticket") {
      return fail("This experience needs a ticket. Scan the ticket instead.", 400);
    }

    const institution = institutionBySlug(activity.institutionSlug);
    if (!institution?.signerRole) return fail("That institution cannot issue achievements.", 400);

    const institutionAddress = await addressForSlug(activity.institutionSlug);
    if (!institutionAddress) {
      return fail("That institution is not registered in the city registry yet.", 409);
    }

    const recipient = getAddress(body.wallet);
    const periodId = periodIdFor(activity.cadence);
    const periodKey = periodKeyFor(activity.cadence);

    // The contract is the authority on this rule, but checking first lets us answer with
    // something friendlier than a reverted transaction.
    const existing = await db().findCompletion(recipient, activity.slug, periodKey);
    if (existing) {
      return fail(
        activity.cadence === "daily"
          ? "This visit is already verified for today."
          : "This achievement has already been earned.",
        409,
        "AlreadyVerified",
      );
    }

    const claim = buildClaim(
      recipient,
      institutionAddress,
      CREDENTIALS[activity.credential].hash,
      periodId,
    );
    const receipt = await verifyActivityOnChain(institution.signerRole, claim);

    await db().recordCompletion({
      wallet: recipient,
      activitySlug: activity.slug,
      institutionSlug: activity.institutionSlug,
      periodKey,
      xpAwarded: activity.xpReward,
      txHash: receipt.txHash,
    });
    const profile = await db().addXp(recipient, activity.xpReward);

    return ok({
      activity: { title: pick(activity.title, locale), emoji: activity.emoji },
      credential: {
        title: pick(CREDENTIALS[activity.credential].title, locale),
        emoji: CREDENTIALS[activity.credential].emoji,
      },
      issuer: pick(institution.label, locale),
      xpAwarded: activity.xpReward,
      totalXp: profile.xp,
      txHash: receipt.txHash,
    });
  });
}

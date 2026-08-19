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
  // Deliberately loose: the address is typed by hand at the desk as often as it is scanned, so
  // the format complaint is answered below in the operator's own language rather than by Zod.
  wallet: z.string().min(1),
  activitySlug: z.string().min(1),
});

export async function POST(request: Request) {
  return handle(async () => {
    const operatorSlug = await requireOperator();
    const body = await parseBody(request, schema);
    const { locale, t } = await getTranslations();

    if (!/^0x[a-fA-F0-9]{40}$/.test(body.wallet)) {
      return fail(t.errors.notAnAccountCode, 400);
    }

    const activity = activityBySlug(body.activitySlug);
    if (!activity) return fail(t.errors.unknownActivity, 404);
    if (!activity.credential) {
      return fail(t.errors.notVerifiedInPerson, 400);
    }
    if (activity.kind === "ticket") {
      return fail(t.errors.needsTicket, 400);
    }

    // Who is signed in decides what may be issued -- not which activity was named. Without this
    // the science center could hand out library badges: the app would sign with the library's
    // own key, so the contract would see a perfectly valid claim and accept it. The chain cannot
    // catch an institution acting outside its remit if the app hands over the wrong pen.
    if (operatorSlug !== activity.institutionSlug) {
      return fail(t.errors.wrongInstitution, 403, "WrongInstitution");
    }

    const institution = institutionBySlug(activity.institutionSlug);
    if (!institution?.signerRole) return fail(t.errors.cannotIssue, 400);

    const institutionAddress = await addressForSlug(activity.institutionSlug);
    if (!institutionAddress) {
      return fail(t.errors.institutionNotRegistered, 409);
    }

    const recipient = getAddress(body.wallet);
    const periodId = periodIdFor(activity.cadence);
    const periodKey = periodKeyFor(activity.cadence);

    // The contract is the authority on this rule, but checking first lets us answer with
    // something friendlier than a reverted transaction.
    const existing = await db().findCompletion(recipient, activity.slug, periodKey);
    if (existing) {
      return fail(
        activity.cadence === "daily" ? t.errors.alreadyVerifiedToday : t.errors.alreadyEarned,
        409,
        "AlreadyVerified",
      );
    }

    // The completion row points at a profile, so a visitor whose account exists only on their
    // phone -- created, but never signed in -- would fail that insert *after* the achievement
    // had already been written to the chain: the badge would exist, the day would be spent, and
    // the desk would see nothing but a generic error. Make the profile first.
    await db().upsertProfile(recipient);

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

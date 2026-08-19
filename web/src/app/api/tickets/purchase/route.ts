import { z } from "zod";
import { fail, handle, ok, parseBody } from "@/server/api";
import { requireWallet } from "@/server/session";
import { activityBySlug, institutionBySlug } from "@/server/catalog";
import { priceForSlug } from "@/server/pricing";
import { CREDENTIALS } from "@/lib/credentials";
import { addressForSlug } from "@/server/institutions";
import { issuePassOnChain } from "@/server/chain/writes";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/types";

/**
 * Buy a ticket for a paid experience.
 *
 * DEMO MOCK -- the payment step is simulated. In production this route would be called by a
 * payment provider's webhook after a real card payment in Turkish lira, and no money would ever
 * touch the blockchain. What the chain provides is only the part a payment provider cannot: a
 * ticket that can be spent exactly once, and that the science center can verify at the door
 * without calling the seller.
 */

const schema = z.object({
  activitySlug: z.string().min(1),
});

const TICKET_VALID_DAYS = 90;

/**
 * A ceiling on how many tickets the whole city issues per hour.
 *
 * Buying a ticket is the one thing a citizen can do that spends the relayer's balance, and a
 * citizen account costs nothing to create -- the device wallet is a keypair generated in the
 * browser. Without a cap, anyone who can reach a public deployment can mint accounts in a loop
 * and drain the account that pays for everyone's gas, which stops the whole city rather than
 * just them.
 *
 * Counted from ticket_orders rather than held in memory, so the limit is real on serverless,
 * where consecutive requests need not reach the same instance.
 *
 * Set well above anything a demo or a school group would reach.
 */
const TICKETS_PER_HOUR = 60;

export async function POST(request: Request) {
  return handle(async () => {
    const wallet = await requireWallet();
    const { activitySlug } = await parseBody(request, schema);
    const { locale, t } = await getTranslations();

    const activity = activityBySlug(activitySlug);
    if (!activity) return fail(t.errors.unknownExperience, 404);
    if (activity.kind !== "ticket" || !activity.credential) {
      return fail(t.errors.noTicketNeeded, 400);
    }

    const institution = institutionBySlug(activity.institutionSlug);
    if (!institution?.signerRole) return fail(t.errors.venueCannotIssueTickets, 400);

    const institutionAddress = await addressForSlug(activity.institutionSlug);
    if (!institutionAddress) {
      return fail(t.errors.venueNotRegistered, 409);
    }

    // Refuse to sell a second ticket for something already completed.
    const existing = await db().findCompletion(wallet, activity.slug, "once");
    if (existing) return fail(t.errors.experienceAlreadyDone, 409);

    const issuedThisHour = await db().countTicketOrdersSince(
      new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    );
    if (issuedThisHour >= TICKETS_PER_HOUR) {
      return fail(getDictionary(locale).activities.tooBusy, 429, "RateLimited");
    }

    const unusedTicket = (await db().listTicketOrders(wallet)).find(
      (order) => order.activitySlug === activity.slug && order.status === "valid",
    );
    if (unusedTicket) {
      return fail(t.errors.unusedTicketExists, 409, "TicketExists");
    }

    const validUntil = BigInt(Math.floor(Date.now() / 1000) + TICKET_VALID_DAYS * 86_400);
    const receipt = await issuePassOnChain(
      institution.signerRole,
      wallet,
      CREDENTIALS[activity.credential].hash,
      validUntil,
    );

    const order = await db().createTicketOrder({
      wallet,
      activitySlug: activity.slug,
      passId: receipt.passId,
      priceTry: await priceForSlug(activity),
      issueTxHash: receipt.txHash,
    });

    return ok({
      ticket: {
        passId: order.passId,
        activityTitle: pick(activity.title, locale),
        emoji: activity.emoji,
        venue: pick(institution.label, locale),
        priceTry: order.priceTry,
        validUntil: new Date(Number(validUntil) * 1000).toISOString(),
      },
      txHash: receipt.txHash,
    });
  });
}

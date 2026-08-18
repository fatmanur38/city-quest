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

export async function POST(request: Request) {
  return handle(async () => {
    const wallet = await requireWallet();
    const { activitySlug } = await parseBody(request, schema);
    const { locale } = await getTranslations();

    const activity = activityBySlug(activitySlug);
    if (!activity) return fail("We do not know that experience.", 404);
    if (activity.kind !== "ticket" || !activity.credential) {
      return fail("That activity does not need a ticket.", 400);
    }

    const institution = institutionBySlug(activity.institutionSlug);
    if (!institution?.signerRole) return fail("That venue cannot issue tickets.", 400);

    const institutionAddress = await addressForSlug(activity.institutionSlug);
    if (!institutionAddress) {
      return fail("That venue is not registered in the city registry yet.", 409);
    }

    // Refuse to sell a second ticket for something already completed.
    const existing = await db().findCompletion(wallet, activity.slug, "once");
    if (existing) return fail("You have already completed this experience.", 409);

    const unusedTicket = (await db().listTicketOrders(wallet)).find(
      (order) => order.activitySlug === activity.slug && order.status === "valid",
    );
    if (unusedTicket) {
      return fail("You already have an unused ticket for this experience.", 409, "TicketExists");
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

import { z } from "zod";
import { fail, handle, ok, parseBody } from "@/server/api";
import { requireOperator } from "@/server/session";
import { activityBySlug, institutionBySlug } from "@/server/catalog";
import { readPass, passOwner } from "@/lib/chain/reads";
import { consumePassOnChain } from "@/server/chain/writes";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";
import { pick } from "@/lib/i18n/types";

/**
 * Spend a ticket at the door.
 *
 * The QR code is only a pointer. Everything that matters -- who owns the ticket, whether it has
 * already been used, whether this venue issued it -- is checked against the contract, which is
 * why a screenshot of someone else's ticket is worthless.
 */

const schema = z.object({
  // Loose on purpose: ticket numbers are typed at the door as well as scanned, so the
  // complaint about the format is answered below in the operator's own language.
  passId: z.string().min(1),
});

export async function POST(request: Request) {
  return handle(async () => {
    const operatorSlug = await requireOperator();
    const { passId } = await parseBody(request, schema);
    const { locale, t } = await getTranslations();

    if (!/^\d+$/.test(passId)) return fail(t.errors.notATicketNumber, 400);

    const institution = institutionBySlug(operatorSlug);
    if (!institution?.signerRole) return fail(t.errors.cannotValidateTickets, 400);

    const pass = await readPass(BigInt(passId));
    if (!pass) return fail(t.errors.ticketNotFound, 404);
    if (pass.status === "Used") return fail(t.errors.ticketUsed, 409, "PassNotValid");
    if (pass.status === "Cancelled") return fail(t.errors.ticketCancelled, 409, "PassNotValid");

    const holder = await passOwner(BigInt(passId));
    if (!holder) return fail(t.errors.ticketHolderUnknown, 404);

    const receipt = await consumePassOnChain(institution.signerRole, BigInt(passId));

    const order = await db().findTicketOrderByPassId(passId);
    await db().markTicketConsumed(passId, receipt.txHash);

    // The credential was minted inside the same transaction. Award the matching points.
    const activity = order ? activityBySlug(order.activitySlug) : undefined;
    let xpAwarded = 0;
    if (activity) {
      const already = await db().findCompletion(holder, activity.slug, "once");
      if (!already) {
        await db().recordCompletion({
          wallet: holder,
          activitySlug: activity.slug,
          institutionSlug: activity.institutionSlug,
          periodKey: "once",
          xpAwarded: activity.xpReward,
          txHash: receipt.txHash,
        });
        await db().addXp(holder, activity.xpReward);
        xpAwarded = activity.xpReward;
      }
    }

    return ok({
      passId,
      holder,
      credential: { title: pick(pass.credential.title, locale), icon: pass.credential.icon },
      activityTitle: pick(activity?.title ?? pass.credential.title, locale),
      issuer: pick(institution.label, locale),
      xpAwarded,
      txHash: receipt.txHash,
    });
  });
}

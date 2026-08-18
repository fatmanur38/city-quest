import { z } from "zod";
import { fail, handle, ok, parseBody } from "@/server/api";
import { requireOperator } from "@/server/session";
import { activityBySlug, institutionBySlug } from "@/server/catalog";
import { readPass, passOwner } from "@/lib/chain/reads";
import { consumePassOnChain } from "@/server/chain/writes";
import { db } from "@/server/db";

/**
 * Spend a ticket at the door.
 *
 * The QR code is only a pointer. Everything that matters -- who owns the ticket, whether it has
 * already been used, whether this venue issued it -- is checked against the contract, which is
 * why a screenshot of someone else's ticket is worthless.
 */

const schema = z.object({
  passId: z.string().regex(/^\d+$/, "not a valid ticket number"),
});

export async function POST(request: Request) {
  return handle(async () => {
    const operatorSlug = await requireOperator();
    const { passId } = await parseBody(request, schema);

    const institution = institutionBySlug(operatorSlug);
    if (!institution?.signerRole) return fail("That institution cannot validate tickets.", 400);

    const pass = await readPass(BigInt(passId));
    if (!pass) return fail("We could not find that ticket.", 404);
    if (pass.status === "Used") return fail("This ticket has already been used.", 409, "PassNotValid");
    if (pass.status === "Cancelled") return fail("This ticket was cancelled.", 409, "PassNotValid");

    const holder = await passOwner(BigInt(passId));
    if (!holder) return fail("We could not find who this ticket belongs to.", 404);

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
      credential: { title: pass.credential.title, emoji: pass.credential.emoji },
      activityTitle: activity?.title ?? pass.credential.title,
      issuer: institution.name,
      xpAwarded,
      txHash: receipt.txHash,
    });
  });
}

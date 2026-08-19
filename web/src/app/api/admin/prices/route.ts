import { z } from "zod";
import { fail, handle, ok, parseBody } from "@/server/api";
import { currentOperator, SessionError } from "@/server/session";
import { activityBySlug } from "@/server/catalog";
import { db } from "@/server/db";
import { loadPrices } from "@/server/pricing";
import { getTranslations } from "@/server/locale";

/**
 * Ticket prices, set by the municipality.
 *
 * Nothing here touches the chain. A price is an ordinary commercial figure charged through
 * ordinary payment rails; the only thing the contracts know about a ticket is that one exists
 * and whether it has been used.
 */

async function requireAdmin(): Promise<void> {
  if ((await currentOperator()) !== "admin") {
    throw new SessionError("adminSignInRequired");
  }
}

const schema = z.object({
  activitySlug: z.string().min(1),
  // Null clears the override and returns the activity to its catalogue price.
  priceTry: z.number().int().min(0).max(100_000).nullable(),
});

export async function GET() {
  return handle(async () => {
    const prices = await loadPrices();
    return ok({ prices: Object.fromEntries(prices) });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const { activitySlug, priceTry } = await parseBody(request, schema);
    const { t } = await getTranslations();

    // Guards against a typo creating a price for an activity nobody can buy.
    const activity = activityBySlug(activitySlug);
    if (!activity) return fail(t.errors.activityDoesNotExist, 404);
    if (activity.kind !== "ticket") return fail(t.errors.onlyTicketedHavePrice, 400);

    if (priceTry === null) {
      await db().clearActivityPrice(activitySlug);
      return ok({
        activitySlug,
        priceTry: activity.priceTry ?? 0,
        source: "catalog",
      });
    }

    const saved = await db().setActivityPrice(activitySlug, priceTry);
    return ok({ activitySlug, priceTry: saved.priceTry, source: "override" });
  });
}

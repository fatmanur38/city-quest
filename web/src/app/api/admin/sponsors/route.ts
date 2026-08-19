import { z } from "zod";
import { handle, ok, parseBody } from "@/server/api";
import { currentOperator, SessionError } from "@/server/session";
import { db } from "@/server/db";

/**
 * The municipality admitting businesses to the ecosystem.
 *
 * Nothing here touches the chain, and that is the honest boundary: an institution's authority to
 * issue achievements is a public fact in the registry contract, while a cafe's offer is a private
 * commercial decision. Only the first needs to be independently verifiable.
 */

async function requireAdmin(): Promise<void> {
  if ((await currentOperator()) !== "admin") {
    throw new SessionError("adminSignInRequired");
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  emoji: z.string().trim().min(1).max(8).default("🏪"),
});

const patchSchema = z.object({
  slug: z.string().min(1),
  approved: z.boolean(),
});

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const [sponsors, offers] = await Promise.all([db().listSponsors(), db().listSponsorOffers()]);
    return ok({
      sponsors: sponsors.map((sponsor) => ({
        ...sponsor,
        offerCount: offers.filter((offer) => offer.sponsorSlug === sponsor.slug).length,
      })),
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await parseBody(request, createSchema);
    return ok({ sponsor: await db().createSponsor(body) });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const { slug, approved } = await parseBody(request, patchSchema);
    return ok({ sponsor: await db().setSponsorApproved(slug, approved) });
  });
}

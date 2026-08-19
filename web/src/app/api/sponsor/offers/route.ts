import { z } from "zod";
import { fail, handle, ok, parseBody } from "@/server/api";
import { requireSponsor } from "@/server/session";
import { db } from "@/server/db";
import { CREDENTIALS } from "@/lib/credentials";
import { activityBySlug } from "@/server/catalog";
import { getTranslations } from "@/server/locale";
import { isIconName } from "@/lib/icons";

/** A business publishing, editing or withdrawing its own offers. Never anyone else's. */

const requirementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("credential"), credential: z.string().min(1) }),
  z.object({
    kind: z.literal("visits"),
    activitySlug: z.string().min(1),
    count: z.number().int().min(1).max(50),
  }),
]);

const createSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(""),
  icon: z.string().refine(isIconName, "unknown icon").default("gift"),
  requirement: requirementSchema,
});

const patchSchema = z.object({ slug: z.string().min(1), active: z.boolean() });

export async function GET() {
  return handle(async () => {
    const sponsorSlug = await requireSponsor();
    return ok({ offers: await db().listSponsorOffers(sponsorSlug) });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const sponsorSlug = await requireSponsor();
    const body = await parseBody(request, createSchema);
    const { t } = await getTranslations();

    // A business may only point at things that exist. Without this a typo produces an offer
    // nobody can ever qualify for, which looks like a broken promise rather than a typo.
    if (body.requirement.kind === "credential") {
      if (!(body.requirement.credential in CREDENTIALS)) {
        return fail(t.errors.unknownCredential, 400);
      }
    } else if (!activityBySlug(body.requirement.activitySlug)) {
      return fail(t.errors.activityDoesNotExist, 400);
    }

    const offer = await db().createSponsorOffer({ ...body, sponsorSlug });
    return ok({ offer });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const sponsorSlug = await requireSponsor();
    const { slug, active } = await parseBody(request, patchSchema);
    const { t } = await getTranslations();

    // Ownership check: the session says which business is signed in, and the offer says which
    // business it belongs to. Anything else would let one sponsor withdraw another's coupons.
    const existing = await db().findSponsorOffer(slug);
    if (!existing || existing.sponsorSlug !== sponsorSlug) {
      return fail(t.errors.offerNotYours, 404);
    }

    return ok({ offer: await db().setSponsorOfferActive(slug, active) });
  });
}

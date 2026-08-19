import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fail, handle, ok, parseBody } from "@/server/api";
import { currentSponsor, endSponsorSession, startSponsorSession } from "@/server/session";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";

/**
 * DEMO MOCK -- a business signs in with the shared code the municipality issued it.
 *
 * In production this is an ordinary business account with its own login. Nothing downstream
 * depends on how the business authenticates: a sponsor holds no key and issues nothing, so the
 * worst a stolen code can do is publish or withdraw that business's own coupons.
 */

const schema = z.object({ accessCode: z.string().trim().min(1).max(64) });

export async function POST(request: Request) {
  return handle(async () => {
    const { accessCode } = await parseBody(request, schema);
    const { t } = await getTranslations();

    // Compared against every business rather than looked up, so the response time does not
    // reveal whether a code's prefix matched something real.
    const sponsors = await db().listSponsors();
    const match = sponsors.find((sponsor) => {
      const a = Buffer.from(sponsor.accessCode);
      const b = Buffer.from(accessCode);
      return a.length === b.length && timingSafeEqual(a, b);
    });

    if (!match) return fail(t.sponsor.wrongCode, 401);

    await startSponsorSession(match.slug);
    return ok({
      sponsor: { slug: match.slug, name: match.name, approved: match.approved },
    });
  });
}

export async function GET() {
  return handle(async () => ok({ sponsor: await currentSponsor() }));
}

export async function DELETE() {
  return handle(async () => {
    await endSponsorSession();
    return ok({ signedOut: true });
  });
}

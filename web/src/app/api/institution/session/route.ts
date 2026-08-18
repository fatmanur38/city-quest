import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { fail, handle, ok, parseBody } from "@/server/api";
import {
  currentOperator,
  endOperatorSession,
  operatorPin,
  startOperatorSession,
} from "@/server/session";
import { institutionBySlug } from "@/server/catalog";

/**
 * DEMO MOCK -- institution staff sign in with a shared PIN. See the note in server/session.ts
 * for what replaces this in production.
 */

const schema = z.object({
  institutionSlug: z.string().min(1),
  pin: z.string().min(1),
});

export async function GET() {
  return handle(async () => ok({ operator: await currentOperator() }));
}

export async function POST(request: Request) {
  return handle(async () => {
    const { institutionSlug, pin } = await parseBody(request, schema);

    const institution = institutionBySlug(institutionSlug);
    if (!institution?.isIssuer) return fail("That institution cannot issue achievements.", 400);

    const expected = Buffer.from(operatorPin());
    const provided = Buffer.from(pin);
    const matches = provided.length === expected.length && timingSafeEqual(provided, expected);
    if (!matches) return fail("That staff code is not correct.", 401);

    await startOperatorSession(institutionSlug);
    return ok({ operator: institutionSlug });
  });
}

export async function DELETE() {
  return handle(async () => {
    await endOperatorSession();
    return ok({ signedOut: true });
  });
}

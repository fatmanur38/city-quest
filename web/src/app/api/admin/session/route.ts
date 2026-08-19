import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { fail, handle, ok, parseBody } from "@/server/api";
import { currentOperator, endOperatorSession, startOperatorSession } from "@/server/session";
import { getTranslations } from "@/server/locale";

/**
 * DEMO MOCK -- the municipality signs in with a PIN. In production this is the city's own staff
 * identity system, and the registrar role would sit behind a multisig rather than a single key.
 */

const ADMIN_ROLE = "admin";

const schema = z.object({ pin: z.string().min(1) });

export function adminPin(): string {
  return process.env.ADMIN_PIN || "cityquest";
}

export async function GET() {
  return handle(async () => ok({ isAdmin: (await currentOperator()) === ADMIN_ROLE }));
}

export async function POST(request: Request) {
  return handle(async () => {
    const { pin } = await parseBody(request, schema);
    const { t } = await getTranslations();
    const expected = Buffer.from(adminPin());
    const provided = Buffer.from(pin);
    const matches = provided.length === expected.length && timingSafeEqual(provided, expected);
    if (!matches) return fail(t.errors.wrongAdminCode, 401);
    await startOperatorSession(ADMIN_ROLE);
    return ok({ isAdmin: true });
  });
}

export async function DELETE() {
  return handle(async () => {
    await endOperatorSession();
    return ok({ signedOut: true });
  });
}

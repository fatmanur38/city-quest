import { z } from "zod";
import { fail, handle, ok, parseBody } from "@/server/api";
import { currentWallet, endSession, startSession, verifySignIn } from "@/server/session";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";

const schema = z.object({
  address: z.string(),
  nonce: z.string(),
  signature: z.string(),
  displayName: z.string().trim().min(1).max(40).optional(),
});

/** Who is signed in right now. */
export async function GET() {
  return handle(async () => {
    const wallet = await currentWallet();
    if (!wallet) return ok({ profile: null });
    const profile = await db().getProfile(wallet);
    return ok({ profile });
  });
}

/** Step two of sign-in: check the signature, then start a session. */
export async function POST(request: Request) {
  return handle(async () => {
    const { address, nonce, signature, displayName } = await parseBody(request, schema);
    const { t } = await getTranslations();

    const result = await verifySignIn(address, nonce, signature);
    if (!result.ok || !result.address) return fail(result.error ?? t.auth.couldNotSignIn, 401);

    await startSession(result.address);
    const profile = await db().upsertProfile(result.address, {
      ...(displayName ? { displayName } : {}),
      defaultDisplayName: t.account.defaultName(result.address.slice(2, 6).toUpperCase()),
    });
    return ok({ profile });
  });
}

export async function DELETE() {
  return handle(async () => {
    await endSession();
    return ok({ signedOut: true });
  });
}

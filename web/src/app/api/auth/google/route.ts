import { z } from "zod";
import { fail, handle, ok, parseBody } from "@/server/api";
import { startSession } from "@/server/session";
import { canDeriveAccounts, deriveAddress } from "@/server/accounts";
import { googleConfigured, verifyGoogleToken } from "@/server/google";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";

/**
 * Signing in with Google.
 *
 * The device-account path proves ownership with a signature, because there is nothing else to
 * go on. Here there is: Google already established who this is, and Supabase already verified
 * Google. So there is no challenge to sign.
 *
 * Which city account this identity opens is a lookup first and a derivation second. Someone who
 * started on a device and later linked their Google account has achievements bound to *that*
 * address, and those achievements are soulbound -- so the link table wins, and derivation is
 * only what happens for an identity nobody has seen before.
 */

const schema = z.object({
  accessToken: z.string().min(1),
});

export async function POST(request: Request) {
  return handle(async () => {
    const { t } = await getTranslations();
    const { accessToken } = await parseBody(request, schema);

    if (!googleConfigured() || !canDeriveAccounts()) {
      return fail(t.errors.googleUnavailable, 503, "NotConfigured");
    }

    const identity = await verifyGoogleToken(accessToken);
    if (!identity) return fail(t.errors.googleSignInFailed, 401);

    const link = await db().findLinkByProvider("google", identity.userId);
    const address = link ? (link.wallet as `0x${string}`) : deriveAddress(identity.userId);

    await startSession(address);

    // Seed the display name from the Google profile the first time only, so a name the citizen
    // later chose for themselves is never overwritten by their Google one.
    const existing = await db().getProfile(address);
    const profile =
      existing ??
      (await db().upsertProfile(address, {
        ...(identity.name ? { displayName: identity.name } : {}),
        defaultDisplayName: t.account.defaultName(address.slice(2, 6).toUpperCase()),
      }));

    // Record the derivation as a link too, so one table answers "is this account reachable by
    // Google" for every account, however it was created. The profile has to exist first: the
    // row points at it.
    if (!link) await db().createLink("google", identity.userId, address);

    return ok({ profile });
  });
}

import { z } from "zod";
import { fail, handle, ok, parseBody } from "@/server/api";
import { requireWallet } from "@/server/session";
import { googleConfigured, verifyGoogleToken } from "@/server/google";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";

/**
 * Attaching a Google account to the city account you already have.
 *
 * This is the rescue path for anyone who started with "continue without signing up". Their
 * achievements are soulbound to the device address, so they cannot be moved to whatever address
 * their Google identity would derive to -- the identity has to be pointed at the existing
 * account instead. That is the whole reason `linked_accounts` exists.
 *
 * It works without the device key ever being involved, because the key was only ever used to
 * sign the sign-in challenge, and a verified Google identity replaces that challenge entirely.
 * So the account survives a cleared browser: the key is gone, the account is not.
 */

const schema = z.object({
  accessToken: z.string().min(1),
});

export async function GET() {
  return handle(async () => {
    const wallet = await requireWallet();
    const link = await db().findLinkByWallet("google", wallet);
    return ok({ linked: Boolean(link), available: googleConfigured() });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { t } = await getTranslations();
    const wallet = await requireWallet();
    const { accessToken } = await parseBody(request, schema);

    if (!googleConfigured()) return fail(t.errors.googleUnavailable, 503, "NotConfigured");

    const identity = await verifyGoogleToken(accessToken);
    if (!identity) return fail(t.errors.googleSignInFailed, 401);

    const byProvider = await db().findLinkByProvider("google", identity.userId);
    if (byProvider) {
      // Linking the same pair twice is what a double-tap or a refreshed callback looks like, and
      // it has already had the effect the person wanted.
      if (byProvider.wallet.toLowerCase() === wallet.toLowerCase()) return ok({ linked: true });
      return fail(t.errors.googleAlreadyLinkedElsewhere, 409, "AlreadyLinked");
    }

    const byWallet = await db().findLinkByWallet("google", wallet);
    if (byWallet) return fail(t.errors.accountAlreadyHasGoogle, 409, "AlreadyLinked");

    await db().createLink("google", identity.userId, wallet);
    return ok({ linked: true });
  });
}

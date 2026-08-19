import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { fail, handle, ok, parseBody } from "@/server/api";
import { startSession } from "@/server/session";
import { canDeriveAccounts, deriveAddress } from "@/server/accounts";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";

/**
 * Signing in with Google.
 *
 * The device-account path proves ownership with a signature, because there is nothing else to
 * go on. Here there is: Google already established who this is, and Supabase already verified
 * Google. So there is no challenge to sign -- the browser hands over the access token it was
 * given, this route asks the auth server whose token it is, and the city account follows from
 * that identity.
 *
 * The token is verified server-side rather than decoded here. A JWT read without checking its
 * signature is just a claim, and the whole point of this route is to stop taking claims at
 * face value.
 */

const schema = z.object({
  accessToken: z.string().min(1),
});

export async function POST(request: Request) {
  return handle(async () => {
    const { t } = await getTranslations();
    const { accessToken } = await parseBody(request, schema);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey || !canDeriveAccounts()) {
      return fail(t.errors.googleUnavailable, 503, "NotConfigured");
    }

    const auth = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await auth.auth.getUser(accessToken);
    if (error || !data.user) return fail(t.errors.googleSignInFailed, 401);

    // The provider's user id, not the email address. An email can be changed and reassigned;
    // losing your city account because you renamed your mailbox would be indefensible.
    const address = deriveAddress(data.user.id);

    await startSession(address);

    // Seed the display name from the Google profile the first time only, so a name the citizen
    // later chose for themselves is never overwritten by their Google one.
    const existing = await db().getProfile(address);
    const suggested =
      typeof data.user.user_metadata?.name === "string"
        ? data.user.user_metadata.name.trim().slice(0, 40)
        : "";
    const profile = existing
      ? existing
      : await db().upsertProfile(address, {
          ...(suggested ? { displayName: suggested } : {}),
          defaultDisplayName: t.account.defaultName(address.slice(2, 6).toUpperCase()),
        });

    return ok({ profile });
  });
}

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/server/db";

/**
 * Establishing that someone owns the Google account they claim.
 *
 * The token is verified against the auth server rather than decoded here. A JWT read without
 * checking its signature is just a claim, and taking claims at face value is exactly what this
 * is here to stop.
 */

export interface GoogleIdentity {
  /** The provider's opaque user id. Stable across email changes, and meaningless outside Google. */
  userId: string;
  /** Only ever used to suggest a display name on a brand-new account. Never stored as-is. */
  name: string | null;
}

export function googleConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function verifyGoogleToken(accessToken: string): Promise<GoogleIdentity | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const auth = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.getUser(accessToken);
  if (error || !data.user) return null;

  const name = typeof data.user.user_metadata?.name === "string" ? data.user.user_metadata.name : null;
  return { userId: data.user.id, name: name?.trim().slice(0, 40) || null };
}

/**
 * Whether this account can be reopened with Google, for the card on the account page.
 *
 * Reads defensively on purpose. The linking card is an optional enhancement, while the page it
 * sits on is where someone looks at what they earned -- so a deployment that has run ahead of
 * its migration, or a database hiccup, must cost the card and never the page. The failure is
 * logged rather than swallowed, so it stays visible to whoever is looking.
 */
export async function googleLinkedFor(wallet: string): Promise<boolean> {
  if (!googleConfigured()) return false;
  try {
    return Boolean(await db().findLinkByWallet("google", wallet));
  } catch (error) {
    console.error("[google] could not read the account link", error);
    return false;
  }
}

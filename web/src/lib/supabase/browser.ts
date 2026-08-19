"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase used for one job only: proving that someone owns the Google account they claim.
 *
 * None of the app's data goes through this client. Once the identity is proven, the server
 * mints its own ordinary session cookie and Supabase is out of the picture -- which keeps the
 * sign-in provider a swappable detail rather than something the whole app leans on.
 */

// Read as literal expressions so Next can inline them at build time.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether this deployment can offer Google sign-in. A button that leads nowhere is worse than
 * no button, so the UI asks before it offers.
 */
export function googleSignInAvailable(): boolean {
  return Boolean(URL && ANON_KEY);
}

let cached: SupabaseClient | null = null;

export function authClient(): SupabaseClient {
  if (!URL || !ANON_KEY) {
    throw new Error("Google sign-in is not configured for this deployment.");
  }
  cached ??= createClient(URL, ANON_KEY, {
    auth: {
      // PKCE: the code comes back on the URL and is exchanged for a token, so no access token
      // is ever exposed in a redirect fragment.
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: false,
    },
  });
  return cached;
}

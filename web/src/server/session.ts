import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { verifyMessage, isAddress, getAddress } from "viem";
import { serverEnv } from "@/lib/env";

/**
 * Sessions without a session table.
 *
 * A citizen proves they control an address by signing a short human-readable message. We check
 * that signature, then hand back an HMAC-signed cookie. Nonces are themselves signed tokens
 * carrying their own expiry, so nothing has to be stored between the two requests.
 */

const CITIZEN_COOKIE = "cq_session";
const OPERATOR_COOKIE = "cq_operator";
const SPONSOR_COOKIE = "cq_sponsor";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const NONCE_TTL_SECONDS = 5 * 60;

function sign(payload: string): string {
  return createHmac("sha256", serverEnv().sessionSecret).update(payload).digest("base64url");
}

function seal(payload: string): string {
  return `${payload}.${sign(payload)}`;
}

function unseal(token: string | undefined): string | null {
  if (!token) return null;
  const index = token.lastIndexOf(".");
  if (index <= 0) return null;
  const payload = token.slice(0, index);
  const provided = Buffer.from(token.slice(index + 1));
  const expected = Buffer.from(sign(payload));
  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? payload : null;
}

// ---------------------------------------------------------------------------------------------
// Sign-in challenge
// ---------------------------------------------------------------------------------------------

export function createNonce(): string {
  const expiresAt = Math.floor(Date.now() / 1000) + NONCE_TTL_SECONDS;
  return seal(`${randomBytes(12).toString("base64url")}:${expiresAt}`);
}

function isNonceValid(nonce: string): boolean {
  const payload = unseal(nonce);
  if (!payload) return false;
  const expiresAt = Number(payload.split(":")[1]);
  return Number.isFinite(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}

/**
 * Deliberately readable. If a wallet ever does show this to a person, it should explain itself
 * in plain language rather than as a wall of hex.
 *
 * The address is checksummed here rather than by the callers. This message is built twice --
 * once when the challenge is handed out and once when the signature is checked -- in two
 * separate requests, and the two strings have to be byte-identical or recovery returns a
 * different address. MetaMask returns lowercase addresses from `eth_requestAccounts` while a
 * viem local account returns them checksummed, so normalising at only one of the two sites
 * verified fine for the device account and rejected every browser wallet.
 */
export function signInMessage(address: string, nonce: string): string {
  return [
    "Sign in to your City Account.",
    "",
    "This only proves the account is yours.",
    "It does not move any money and costs nothing.",
    "",
    `Account: ${getAddress(address)}`,
    `Code: ${nonce}`,
  ].join("\n");
}

export interface SignInResult {
  ok: boolean;
  address?: `0x${string}`;
  error?: string;
}

export async function verifySignIn(
  address: string,
  nonce: string,
  signature: string,
): Promise<SignInResult> {
  if (!isAddress(address)) return { ok: false, error: "That is not a valid city account address." };
  if (!isNonceValid(nonce)) return { ok: false, error: "Your sign-in code expired. Try again." };

  const checksummed = getAddress(address);
  try {
    const valid = await verifyMessage({
      address: checksummed,
      message: signInMessage(checksummed, nonce),
      signature: signature as `0x${string}`,
    });
    if (!valid) return { ok: false, error: "That signature does not match the account." };
  } catch {
    return { ok: false, error: "That signature could not be read." };
  }
  return { ok: true, address: checksummed };
}

// ---------------------------------------------------------------------------------------------
// Citizen session
// ---------------------------------------------------------------------------------------------

export async function startSession(address: `0x${string}`): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const store = await cookies();
  store.set(CITIZEN_COOKIE, seal(`${address.toLowerCase()}:${expiresAt}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(CITIZEN_COOKIE);
}

/** The signed-in citizen's address, or null. */
export async function currentWallet(): Promise<`0x${string}` | null> {
  const payload = unseal((await cookies()).get(CITIZEN_COOKIE)?.value);
  if (!payload) return null;
  const [wallet, expiresAt] = payload.split(":");
  if (!wallet || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return null;
  return isAddress(wallet) ? getAddress(wallet) : null;
}

export async function requireWallet(): Promise<`0x${string}`> {
  const wallet = await currentWallet();
  if (!wallet) throw new SessionError("signInRequired");
  return wallet;
}

/**
 * A missing or expired session. Carries a dictionary key rather than a sentence, so the one
 * place that turns errors into responses can say it in the reader's language.
 */
export type SessionErrorKey =
  | "signInRequired"
  | "businessSignInRequired"
  | "staffSignInRequired"
  | "adminSignInRequired";

export class SessionError extends Error {
  constructor(readonly key: SessionErrorKey) {
    super(key);
  }
}

// ---------------------------------------------------------------------------------------------
// Institution operator session
// ---------------------------------------------------------------------------------------------

/**
 * DEMO MOCK -- institution staff authenticate with a shared PIN.
 *
 * It exists so that "any browser can mint credentials" is not literally true during the demo.
 * In production each institution would have real staff accounts (municipal SSO, or a device
 * certificate on the kiosk), and the signing key would live in an HSM rather than in an
 * environment variable. The contract-level guarantee is unaffected either way: an institution
 * that is not in the registry cannot issue anything, no matter who is holding the laptop.
 */
export function operatorPin(): string {
  return process.env.OPERATOR_PIN || "1234";
}

/**
 * Whether the sign-in codes are still the ones this repository ships with.
 *
 * The sign-in screens print the demo code so a fresh clone is usable immediately. On anything
 * public that hint has to disappear, and tying it to the codes themselves means it does so the
 * moment they are changed -- nobody has to remember to remove it before deploying.
 */
export function usesDemoCodes(): { operator: boolean; admin: boolean } {
  return {
    // Read directly rather than through adminPin(), which lives in the admin session route --
    // importing it here would make session.ts and that route circular.
    operator: operatorPin() === "1234",
    admin: (process.env.ADMIN_PIN || "cityquest") === "cityquest",
  };
}

export async function startOperatorSession(role: string): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const store = await cookies();
  store.set(OPERATOR_COOKIE, seal(`${role}:${expiresAt}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/**
 * Business sessions.
 *
 * Separate from the operator cookie on purpose. A sponsor is not staff: it cannot confirm a
 * visit, cannot issue anything and has no standing in the registry. Sharing one cookie would
 * have made those two very different kinds of account one bug away from each other.
 */
export async function startSponsorSession(slug: string): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const store = await cookies();
  store.set(SPONSOR_COOKIE, seal(`${slug}:${expiresAt}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSponsorSession(): Promise<void> {
  (await cookies()).delete(SPONSOR_COOKIE);
}

/** The signed-in business's slug, or null. */
export async function currentSponsor(): Promise<string | null> {
  const payload = unseal((await cookies()).get(SPONSOR_COOKIE)?.value);
  if (!payload) return null;
  const [slug, expiresAt] = payload.split(":");
  if (!slug || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return null;
  return slug;
}

export async function requireSponsor(): Promise<string> {
  const slug = await currentSponsor();
  if (!slug) throw new SessionError("businessSignInRequired");
  return slug;
}

export async function endOperatorSession(): Promise<void> {
  (await cookies()).delete(OPERATOR_COOKIE);
}

export async function currentOperator(): Promise<string | null> {
  const payload = unseal((await cookies()).get(OPERATOR_COOKIE)?.value);
  if (!payload) return null;
  const [role, expiresAt] = payload.split(":");
  if (!role || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return null;
  return role;
}

export async function requireOperator(): Promise<string> {
  const role = await currentOperator();
  if (!role) throw new SessionError("staffSignInRequired");
  return role;
}

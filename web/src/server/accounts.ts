import "server-only";
import { hkdfSync } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import type { Address } from "viem";

/**
 * Turning a Google account into a city account.
 *
 * The problem this solves: the device account is created in the browser and lives in local
 * storage, so clearing site data loses it, and it does not follow you to a second device. For
 * a fourteen-year-old who signed in once at the library and comes back on their phone, that is
 * not an edge case -- it is the normal thing to happen.
 *
 * So the address is *derived* rather than stored: the same Google identity always produces the
 * same city account, on any device, with nothing kept in a table that could drift or leak.
 *
 * What this costs, stated plainly: the server can compute this key, so it could sign as the
 * citizen. That is a real trade and it is acceptable *here* specifically because the citizen
 * key is not a credential. It holds no funds, and it cannot issue anything -- only an
 * institution's key can create an achievement, and a citizen never signs a transaction at all.
 * The key names who an achievement belongs to; it does not grant anything.
 *
 * The production answer is the one already written in the README: a passkey-backed smart
 * account, where the key sits in the device's secure enclave and is recoverable without anyone
 * else being able to derive it. This module is the bridge until then, and it is deliberately
 * one function wide so that replacing it is a small job.
 */

/**
 * Bumping this re-derives every account from scratch, orphaning the achievements already
 * issued to the old addresses. It is part of the derivation input for exactly that reason:
 * a version change has to be a decision, not an accident.
 */
const VERSION = "cityquest/account/v1";

export class MissingDerivationSecretError extends Error {
  constructor() {
    super("ACCOUNT_DERIVATION_SECRET is not set, so Google sign-in is unavailable.");
  }
}

function secret(): string {
  const value = process.env.ACCOUNT_DERIVATION_SECRET;
  // No fallback to SESSION_SECRET on purpose. Session secrets are meant to be rotatable, and
  // rotating this one would silently strand every account that had ever been created.
  if (!value || value.length < 16) throw new MissingDerivationSecretError();
  return value;
}

/** Whether this deployment is able to offer Google sign-in at all. */
export function canDeriveAccounts(): boolean {
  const value = process.env.ACCOUNT_DERIVATION_SECRET;
  return Boolean(value && value.length >= 16);
}

const SECP256K1_ORDER = BigInt(
  "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
);

/**
 * The city account belonging to an external identity, keyed by a provider's stable user id.
 *
 * Derives with HKDF rather than a plain hash so the secret is used as key material in the way
 * it was designed to be, and so `info` cleanly separates one user from another.
 */
export function deriveAccount(providerUserId: string): { address: Address; privateKey: `0x${string}` } {
  const ikm = Buffer.from(secret(), "utf8");
  const salt = Buffer.from(VERSION, "utf8");

  // A derived scalar must be in [1, n). The chance of falling outside is about 2^-128, but a
  // loop is two lines and an unhandled case here would be an account that cannot be created.
  for (let counter = 0; counter < 256; counter += 1) {
    const info = Buffer.from(`${providerUserId}:${counter}`, "utf8");
    const bytes = Buffer.from(hkdfSync("sha256", ikm, salt, info, 32));
    const scalar = BigInt(`0x${bytes.toString("hex")}`);
    if (scalar === 0n || scalar >= SECP256K1_ORDER) continue;

    const privateKey = `0x${bytes.toString("hex")}` as `0x${string}`;
    return { address: privateKeyToAccount(privateKey).address, privateKey };
  }

  throw new Error("Could not derive a city account for that identity.");
}

/** The address alone, which is all any caller has needed so far. */
export function deriveAddress(providerUserId: string): Address {
  return deriveAccount(providerUserId).address;
}

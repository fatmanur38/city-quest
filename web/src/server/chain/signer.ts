import "server-only";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { publicEnv, serverEnv } from "@/lib/env";
import type { SignerRole } from "@/server/catalog";

/**
 * Institution signing keys.
 *
 * These never reach the browser. An institution signs a claim on its own server, and the claim
 * is worthless to anyone else: it names one recipient, one achievement and one period, and it
 * expires in minutes.
 *
 * DEMO SETUP -- all three institutions are served by one Next.js process here, so their keys sit
 * in one .env file. In production each institution runs its own signing service and the key
 * lives in that institution's HSM or KMS. Nothing in the contracts changes: they only ever see
 * a signature, and only ever ask the registry whether that signer is authorised.
 */

export const ACTIVITY_CLAIM_TYPES = {
  ActivityClaim: [
    { name: "recipient", type: "address" },
    { name: "institution", type: "address" },
    { name: "credentialType", type: "bytes32" },
    { name: "periodId", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/** Must match EIP712("CityQuest Passport", "1") in CityPassport.sol. */
export function passportDomain() {
  return {
    name: "CityQuest Passport",
    version: "1",
    chainId: publicEnv.chainId,
    verifyingContract: publicEnv.cityPassport,
  } as const;
}

export const PASS_ISSUANCE_TYPES = {
  PassIssuance: [
    { name: "recipient", type: "address" },
    { name: "institution", type: "address" },
    { name: "credentialType", type: "bytes32" },
    { name: "validUntil", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export const CONSUME_AUTHORIZATION_TYPES = {
  ConsumeAuthorization: [
    { name: "passId", type: "uint256" },
    { name: "institution", type: "address" },
    { name: "expiresAt", type: "uint64" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/** Must match EIP712("CityQuest Experience", "1") in ExperiencePass.sol. */
export function experienceDomain() {
  return {
    name: "CityQuest Experience",
    version: "1",
    chainId: publicEnv.chainId,
    verifyingContract: publicEnv.experiencePass,
  } as const;
}

export class MissingSignerError extends Error {
  constructor(role: SignerRole) {
    super(
      `No signing key configured for the ${role} institution. ` +
        "Check the *_SIGNER_PRIVATE_KEY entries in .env.local.",
    );
  }
}

export function institutionAccount(role: SignerRole): PrivateKeyAccount {
  const env = serverEnv();
  const key =
    role === "library"
      ? env.librarySignerPrivateKey
      : role === "scienceCenter"
        ? env.scienceCenterSignerPrivateKey
        : env.municipalitySignerPrivateKey;
  if (!key) throw new MissingSignerError(role);
  return privateKeyToAccount(key);
}

export class MissingRelayerError extends Error {
  constructor() {
    super("No RELAYER_PRIVATE_KEY configured, so transactions cannot be submitted.");
  }
}

/**
 * The only account in the whole system that needs a gas balance.
 *
 * It has no authority of its own: every transaction it sends carries an institution's signature,
 * and the contracts check that signature rather than who submitted it. Draining this account
 * stops the service; it cannot be used to forge anything.
 */
export function relayerAccount(): PrivateKeyAccount {
  const key = serverEnv().relayerPrivateKey;
  if (!key) throw new MissingRelayerError();
  return privateKeyToAccount(key);
}

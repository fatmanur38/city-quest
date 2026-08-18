import "server-only";
import { createWalletClient, http, toHex, type Hex } from "viem";
import { randomBytes } from "node:crypto";
import { publicEnv } from "@/lib/env";
import { activeChain, publicClient } from "@/lib/chain/client";
import { contracts, institutionTypeIndex, type InstitutionTypeName } from "@/lib/chain/contracts";
import type { SignerRole } from "@/server/catalog";
import { ACTIVITY_CLAIM_TYPES, institutionAccount, passportDomain, relayerAccount } from "./signer";

/**
 * Every transaction this app sends.
 *
 * The pattern that matters is in `verifyActivity`: the institution signs, the relayer submits.
 * The citizen is not involved in the transaction at all, which is why they never need gas, a
 * seed phrase, or any idea that a blockchain exists.
 */

const CLAIM_TTL_SECONDS = 300;

function walletFor(account: ReturnType<typeof relayerAccount>) {
  return createWalletClient({ account, chain: activeChain(), transport: http(publicEnv.rpcUrl) });
}

export interface ActivityClaim {
  recipient: `0x${string}`;
  institution: `0x${string}`;
  credentialType: `0x${string}`;
  periodId: bigint;
  expiresAt: bigint;
  nonce: `0x${string}`;
}

export function buildClaim(
  recipient: `0x${string}`,
  institution: `0x${string}`,
  credentialType: `0x${string}`,
  periodId: bigint,
): ActivityClaim {
  return {
    recipient,
    institution,
    credentialType,
    periodId,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + CLAIM_TTL_SECONDS),
    nonce: toHex(randomBytes(32)),
  };
}

/** Produces the institution's EIP-712 signature over a claim. */
export async function signClaim(role: SignerRole, claim: ActivityClaim): Promise<Hex> {
  const account = institutionAccount(role);
  return account.signTypedData({
    domain: passportDomain(),
    types: ACTIVITY_CLAIM_TYPES,
    primaryType: "ActivityClaim",
    message: claim,
  });
}

export interface TxResult {
  txHash: `0x${string}`;
  blockNumber: string;
}

/**
 * Sign as the institution, submit as the relayer, wait for the receipt.
 *
 * Reverts surface as thrown errors carrying the contract's custom error name, which the API
 * routes translate into plain language for the citizen.
 */
export async function verifyActivityOnChain(
  role: SignerRole,
  claim: ActivityClaim,
): Promise<TxResult> {
  const signature = await signClaim(role, claim);
  const relayer = relayerAccount();

  // Simulate first so a predictable failure (already claimed today, unauthorised institution)
  // is reported before we spend anything.
  const { request } = await publicClient().simulateContract({
    ...contracts.passport,
    functionName: "verifyActivity",
    args: [claim, signature],
    account: relayer,
  });

  const txHash = await walletFor(relayer).writeContract(request);
  const receipt = await publicClient().waitForTransactionReceipt({ hash: txHash });
  return { txHash, blockNumber: receipt.blockNumber.toString() };
}

/**
 * Issue a ticket. Unlike credentials this is sent by the institution itself, because the
 * contract records `msg.sender` as the issuing institution.
 */
export async function issuePassOnChain(
  role: SignerRole,
  to: `0x${string}`,
  credentialType: `0x${string}`,
  validUntil: bigint,
): Promise<TxResult & { passId: string }> {
  const account = institutionAccount(role);
  const client = publicClient();

  const { request, result } = await client.simulateContract({
    ...contracts.experiencePass,
    functionName: "issuePass",
    args: [to, credentialType, validUntil],
    account,
  });

  const txHash = await walletFor(account).writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  return { txHash, blockNumber: receipt.blockNumber.toString(), passId: result.toString() };
}

/** Spend a ticket. The same transaction awards the achievement. */
export async function consumePassOnChain(role: SignerRole, passId: bigint): Promise<TxResult> {
  const account = institutionAccount(role);
  const client = publicClient();

  const { request } = await client.simulateContract({
    ...contracts.experiencePass,
    functionName: "consumePass",
    args: [passId],
    account,
  });

  const txHash = await walletFor(account).writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  return { txHash, blockNumber: receipt.blockNumber.toString() };
}

/** Admin action: authorise a new institution. */
export async function registerInstitutionOnChain(
  address: `0x${string}`,
  name: string,
  kind: InstitutionTypeName,
): Promise<TxResult> {
  const admin = relayerAccount();
  const client = publicClient();

  const { request } = await client.simulateContract({
    ...contracts.registry,
    functionName: "registerInstitution",
    args: [address, name, institutionTypeIndex(kind)],
    account: admin,
  });

  const txHash = await walletFor(admin).writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  return { txHash, blockNumber: receipt.blockNumber.toString() };
}

export async function setInstitutionActiveOnChain(
  address: `0x${string}`,
  active: boolean,
): Promise<TxResult> {
  const admin = relayerAccount();
  const client = publicClient();

  const { request } = await client.simulateContract({
    ...contracts.registry,
    functionName: active ? "reactivateInstitution" : "deactivateInstitution",
    args: [address],
    account: admin,
  });

  const txHash = await walletFor(admin).writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  return { txHash, blockNumber: receipt.blockNumber.toString() };
}

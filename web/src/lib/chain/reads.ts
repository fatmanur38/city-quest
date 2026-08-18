import { isChainConfigured } from "@/lib/env";
import { describeCredential, type CredentialDefinition } from "@/lib/credentials";
import { publicClient } from "./client";
import { contracts, institutionTypeName, type InstitutionTypeName } from "./contracts";

/**
 * Every read in the app goes through here.
 *
 * All of these tolerate an unconfigured or unreachable chain by returning empty results. A demo
 * should degrade to "no achievements yet", never to a broken page.
 */

export interface OnChainCredential {
  definition: CredentialDefinition;
  hash: `0x${string}`;
  issuer: `0x${string}`;
  issuedAtDay: number;
  issuedAt: Date;
  revoked: boolean;
}

export interface OnChainInstitution {
  address: `0x${string}`;
  name: string;
  kind: InstitutionTypeName;
  active: boolean;
  registered: boolean;
}

export type PassStatusName = "None" | "Valid" | "Used" | "Cancelled";
const PASS_STATUS: PassStatusName[] = ["None", "Valid", "Used", "Cancelled"];

export interface OnChainPass {
  passId: string;
  institution: `0x${string}`;
  credential: CredentialDefinition;
  credentialHash: `0x${string}`;
  status: PassStatusName;
  issuedAt: Date;
  validUntil: Date | null;
}

export async function readCredentials(holder: `0x${string}`): Promise<OnChainCredential[]> {
  if (!isChainConfigured) return [];
  try {
    const raw = await publicClient().readContract({
      ...contracts.passport,
      functionName: "getCredentials",
      args: [holder],
    });
    return raw
      .filter((credential) => credential.exists)
      .map((credential) => ({
        definition: describeCredential(credential.credentialType),
        hash: credential.credentialType,
        issuer: credential.issuer,
        issuedAtDay: credential.issuedAtDay,
        issuedAt: new Date(credential.issuedAtDay * 86_400_000),
        revoked: credential.revoked,
      }));
  } catch (error) {
    console.error("[chain] readCredentials failed", error);
    return [];
  }
}

export async function hasCredential(
  holder: `0x${string}`,
  credentialHash: `0x${string}`,
): Promise<boolean> {
  if (!isChainConfigured) return false;
  try {
    return await publicClient().readContract({
      ...contracts.passport,
      functionName: "hasCredential",
      args: [holder, credentialHash],
    });
  } catch (error) {
    console.error("[chain] hasCredential failed", error);
    return false;
  }
}

/** Has this citizen already been verified for this activity, in this period? */
export async function isActivityVerified(
  recipient: `0x${string}`,
  institution: `0x${string}`,
  credentialHash: `0x${string}`,
  periodId: bigint,
): Promise<boolean> {
  if (!isChainConfigured) return false;
  try {
    const client = publicClient();
    const recordKey = await client.readContract({
      ...contracts.passport,
      functionName: "activityRecordKey",
      args: [recipient, institution, credentialHash, periodId],
    });
    return await client.readContract({
      ...contracts.passport,
      functionName: "isActivityVerified",
      args: [recordKey],
    });
  } catch (error) {
    console.error("[chain] isActivityVerified failed", error);
    return false;
  }
}

export async function readInstitutions(): Promise<OnChainInstitution[]> {
  if (!isChainConfigured) return [];
  try {
    const client = publicClient();
    const addresses = await client.readContract({
      ...contracts.registry,
      functionName: "allInstitutions",
    });
    const details = await Promise.all(
      addresses.map((address) =>
        client.readContract({
          ...contracts.registry,
          functionName: "getInstitution",
          args: [address],
        }),
      ),
    );
    return addresses.map((address, index) => ({
      address,
      name: details[index].name,
      kind: institutionTypeName(details[index].kind),
      active: details[index].active,
      registered: details[index].registered,
    }));
  } catch (error) {
    console.error("[chain] readInstitutions failed", error);
    return [];
  }
}

export async function isAuthorizedInstitution(address: `0x${string}`): Promise<boolean> {
  if (!isChainConfigured) return false;
  try {
    return await publicClient().readContract({
      ...contracts.registry,
      functionName: "isAuthorizedInstitution",
      args: [address],
    });
  } catch (error) {
    console.error("[chain] isAuthorizedInstitution failed", error);
    return false;
  }
}

export async function readPasses(holder: `0x${string}`): Promise<OnChainPass[]> {
  if (!isChainConfigured) return [];
  try {
    const [ids, passes] = await publicClient().readContract({
      ...contracts.experiencePass,
      functionName: "getPasses",
      args: [holder],
    });
    return ids.map((id, index) => {
      const pass = passes[index];
      return {
        passId: id.toString(),
        institution: pass.institution,
        credential: describeCredential(pass.credentialType),
        credentialHash: pass.credentialType,
        status: PASS_STATUS[pass.status] ?? "None",
        issuedAt: new Date(pass.issuedAtDay * 86_400_000),
        validUntil: pass.validUntil > 0n ? new Date(Number(pass.validUntil) * 1000) : null,
      };
    });
  } catch (error) {
    console.error("[chain] readPasses failed", error);
    return [];
  }
}

export async function readPass(passId: bigint): Promise<OnChainPass | null> {
  if (!isChainConfigured) return null;
  try {
    const pass = await publicClient().readContract({
      ...contracts.experiencePass,
      functionName: "getPass",
      args: [passId],
    });
    if (pass.status === 0) return null;
    return {
      passId: passId.toString(),
      institution: pass.institution,
      credential: describeCredential(pass.credentialType),
      credentialHash: pass.credentialType,
      status: PASS_STATUS[pass.status] ?? "None",
      issuedAt: new Date(pass.issuedAtDay * 86_400_000),
      validUntil: pass.validUntil > 0n ? new Date(Number(pass.validUntil) * 1000) : null,
    };
  } catch (error) {
    console.error("[chain] readPass failed", error);
    return null;
  }
}

export async function passOwner(passId: bigint): Promise<`0x${string}` | null> {
  if (!isChainConfigured) return null;
  try {
    return await publicClient().readContract({
      ...contracts.experiencePass,
      functionName: "ownerOf",
      args: [passId],
    });
  } catch {
    return null;
  }
}

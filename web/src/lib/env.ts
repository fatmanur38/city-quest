import { z } from "zod";

/**
 * Environment access, validated once and in one place.
 *
 * Public values are read through literal `process.env.NEXT_PUBLIC_*` expressions because Next
 * inlines them at build time; dynamic lookups would come back undefined in the browser.
 */

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 20-byte hex address")
  .transform((value) => value as `0x${string}`);

const privateKeySchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "must be a 32-byte hex private key")
  .transform((value) => value as `0x${string}`);

const publicSchema = z.object({
  chainId: z.coerce.number().int().positive(),
  rpcUrl: z.url(),
  explorerUrl: z.string().default(""),
  institutionRegistry: addressSchema,
  cityPassport: addressSchema,
  experiencePass: addressSchema,
});

export type PublicEnv = z.infer<typeof publicSchema>;

const rawPublic = {
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL,
  institutionRegistry: process.env.NEXT_PUBLIC_INSTITUTION_REGISTRY_ADDRESS,
  cityPassport: process.env.NEXT_PUBLIC_CITY_PASSPORT_ADDRESS,
  experiencePass: process.env.NEXT_PUBLIC_EXPERIENCE_PASS_ADDRESS,
};

const parsedPublic = publicSchema.safeParse(rawPublic);

/**
 * True when the contract addresses are configured. The app stays usable without them -- the
 * landing page, activity listings and quest descriptions all still render -- so a missing
 * deployment degrades into a read-only preview instead of a stack trace.
 */
export const isChainConfigured = parsedPublic.success;

export const publicEnv: PublicEnv = parsedPublic.success
  ? parsedPublic.data
  : {
      chainId: 31337,
      rpcUrl: "http://127.0.0.1:8545",
      explorerUrl: "",
      institutionRegistry: "0x0000000000000000000000000000000000000000",
      cityPassport: "0x0000000000000000000000000000000000000000",
      experiencePass: "0x0000000000000000000000000000000000000000",
    };

export function chainConfigError(): string | null {
  if (parsedPublic.success) return null;
  return parsedPublic.error.issues
    .map((issue) => `NEXT_PUBLIC_${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

/**
 * Catches the configuration mistakes that would otherwise fail silently.
 *
 * The dangerous one is confusing the two variable sets: Foundry's deploy script takes institution
 * *addresses*, while this app takes institution *private keys*. Pasting a key into a variable
 * named ADDRESS leaves the app with no signer at all, and the only symptom is a check-in that
 * refuses for no visible reason.
 */
export function configWarnings(): string[] {
  const warnings: string[] = [];
  const isKey = (v?: string) => Boolean(v && /^0x[0-9a-fA-F]{64}$/.test(v));

  if (!process.env.RELAYER_PRIVATE_KEY && isKey(process.env.DEPLOYER_PRIVATE_KEY)) {
    warnings.push(
      "DEPLOYER_PRIVATE_KEY is set but RELAYER_PRIVATE_KEY is not. This app reads " +
        "RELAYER_PRIVATE_KEY; DEPLOYER_PRIVATE_KEY is only used by the Foundry deploy script. " +
        "Rename it in .env.local.",
    );
  }

  for (const role of ["LIBRARY", "SCIENCE_CENTER", "MUNICIPALITY"]) {
    if (isKey(process.env[`${role}_SIGNER_ADDRESS`])) {
      warnings.push(
        `${role}_SIGNER_ADDRESS holds a private key, not an address. The app wants ` +
          `${role}_SIGNER_PRIVATE_KEY; the deploy script wants the matching address.`,
      );
    }
    if (!process.env[`${role}_SIGNER_PRIVATE_KEY`]) {
      warnings.push(`${role}_SIGNER_PRIVATE_KEY is missing, so that institution cannot sign.`);
    }
  }

  return warnings;
}

/** Server-only secrets. Never import this module from a client component. */
const serverSchema = z.object({
  relayerPrivateKey: privateKeySchema.optional(),
  librarySignerPrivateKey: privateKeySchema.optional(),
  scienceCenterSignerPrivateKey: privateKeySchema.optional(),
  municipalitySignerPrivateKey: privateKeySchema.optional(),
  sessionSecret: z.string().min(16).default("cityquest-development-secret-change-me"),
  supabaseUrl: z.string().optional(),
  supabaseServiceRoleKey: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedServerEnv: ServerEnv | null = null;

let warned = false;

export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  if (!warned) {
    warned = true;
    for (const warning of configWarnings()) console.warn(`[env] ${warning}`);
  }

  cachedServerEnv = serverSchema.parse({
    relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY || undefined,
    librarySignerPrivateKey: process.env.LIBRARY_SIGNER_PRIVATE_KEY || undefined,
    scienceCenterSignerPrivateKey: process.env.SCIENCE_CENTER_SIGNER_PRIVATE_KEY || undefined,
    municipalitySignerPrivateKey: process.env.MUNICIPALITY_SIGNER_PRIVATE_KEY || undefined,
    sessionSecret: process.env.SESSION_SECRET || undefined,
    supabaseUrl: process.env.SUPABASE_URL || undefined,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  });
  return cachedServerEnv;
}

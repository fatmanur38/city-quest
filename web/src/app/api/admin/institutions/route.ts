import { z } from "zod";
import { getAddress } from "viem";
import { fail, handle, ok, parseBody } from "@/server/api";
import { currentOperator, SessionError } from "@/server/session";
import { INSTITUTION_TYPES, type InstitutionTypeName } from "@/lib/chain/contracts";
import { readInstitutions } from "@/lib/chain/reads";
import {
  registerInstitutionOnChain,
  renameInstitutionOnChain,
  setInstitutionActiveOnChain,
} from "@/server/chain/writes";
import { getTranslations } from "@/server/locale";

/** Authorising and suspending institutions. Only the municipality can do this. */

async function requireAdmin(): Promise<void> {
  if ((await currentOperator()) !== "admin") {
    throw new SessionError("adminSignInRequired");
  }
}

const registerSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "not a valid address"),
  name: z.string().trim().min(1).max(60),
  kind: z.enum(INSTITUTION_TYPES),
});

// One PATCH, two possible edits. `active` and `name` are each optional so a caller can change
// the status, the name, or both -- but at least one has to be present, or the request is a
// no-op that would still cost a transaction.
const patchSchema = z
  .object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "not a valid address"),
    active: z.boolean().optional(),
    name: z.string().trim().min(1).max(60).optional(),
  })
  .refine((body) => body.active !== undefined || body.name !== undefined, {
    message: "nothing to change",
  });

export async function GET() {
  return handle(async () => ok({ institutions: await readInstitutions() }));
}

export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const { address, name, kind } = await parseBody(request, registerSchema);
    const { t } = await getTranslations();

    const existing = await readInstitutions();
    if (existing.some((i) => i.address.toLowerCase() === address.toLowerCase())) {
      return fail(t.errors.institutionAlreadyRegistered, 409);
    }

    const receipt = await registerInstitutionOnChain(
      getAddress(address),
      name,
      kind as InstitutionTypeName,
    );
    return ok({ address: getAddress(address), name, kind, txHash: receipt.txHash });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const { address, active, name } = await parseBody(request, patchSchema);
    const account = getAddress(address);

    // Two separate transactions when both change. The registry keeps status and name apart, and
    // batching them behind one call would mean a failed rename could silently undo a suspension.
    let txHash: string | undefined;
    if (name !== undefined) {
      txHash = (await renameInstitutionOnChain(account, name)).txHash;
    }
    if (active !== undefined) {
      txHash = (await setInstitutionActiveOnChain(account, active)).txHash;
    }

    return ok({ address: account, active, name, txHash });
  });
}

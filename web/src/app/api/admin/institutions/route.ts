import { z } from "zod";
import { getAddress } from "viem";
import { fail, handle, ok, parseBody } from "@/server/api";
import { currentOperator, SessionError } from "@/server/session";
import { INSTITUTION_TYPES, type InstitutionTypeName } from "@/lib/chain/contracts";
import { readInstitutions } from "@/lib/chain/reads";
import {
  registerInstitutionOnChain,
  setInstitutionActiveOnChain,
} from "@/server/chain/writes";

/** Authorising and suspending institutions. Only the municipality can do this. */

async function requireAdmin(): Promise<void> {
  if ((await currentOperator()) !== "admin") {
    throw new SessionError("Municipality administrator sign-in required.");
  }
}

const registerSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "not a valid address"),
  name: z.string().trim().min(1).max(60),
  kind: z.enum(INSTITUTION_TYPES),
});

const statusSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "not a valid address"),
  active: z.boolean(),
});

export async function GET() {
  return handle(async () => ok({ institutions: await readInstitutions() }));
}

export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin();
    const { address, name, kind } = await parseBody(request, registerSchema);

    const existing = await readInstitutions();
    if (existing.some((i) => i.address.toLowerCase() === address.toLowerCase())) {
      return fail("That institution is already registered.", 409);
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
    const { address, active } = await parseBody(request, statusSchema);
    const receipt = await setInstitutionActiveOnChain(getAddress(address), active);
    return ok({ address: getAddress(address), active, txHash: receipt.txHash });
  });
}

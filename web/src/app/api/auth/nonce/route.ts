import { z } from "zod";
import { isAddress } from "viem";
import { handle, ok, parseBody } from "@/server/api";
import { createNonce, signInMessage } from "@/server/session";

// `isAddress` rather than a shape regex: signInMessage checksums what it is given, and that
// throws on a mixed-case address whose checksum does not add up. Rejecting it here turns a
// malformed address into a plain 400 instead of an opaque 500.
const schema = z.object({
  address: z.string().refine(isAddress, "not a valid city account address"),
});

/** Step one of sign-in: hand out a short-lived challenge to sign. */
export async function POST(request: Request) {
  return handle(async () => {
    const { address } = await parseBody(request, schema);
    const nonce = createNonce();
    return ok({ nonce, message: signInMessage(address, nonce) });
  });
}

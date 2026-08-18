import { z } from "zod";
import { handle, ok, parseBody } from "@/server/api";
import { createNonce, signInMessage } from "@/server/session";

const schema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "not a valid passport address"),
});

/** Step one of sign-in: hand out a short-lived challenge to sign. */
export async function POST(request: Request) {
  return handle(async () => {
    const { address } = await parseBody(request, schema);
    const nonce = createNonce();
    return ok({ nonce, message: signInMessage(address, nonce) });
  });
}

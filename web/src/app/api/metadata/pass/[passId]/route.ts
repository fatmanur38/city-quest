import { NextResponse } from "next/server";
import { readPass } from "@/lib/chain/reads";
import { resolveInstitutions } from "@/server/institutions";
import { isChainConfigured } from "@/lib/env";

/** ERC-721 metadata for an experience ticket. */
export async function GET(_request: Request, ctx: { params: Promise<{ passId: string }> }) {
  const { passId } = await ctx.params;

  if (!/^\d+$/.test(passId) || !isChainConfigured) {
    return NextResponse.json({ error: "Unknown ticket" }, { status: 404 });
  }

  const pass = await readPass(BigInt(passId));
  if (!pass) return NextResponse.json({ error: "Unknown ticket" }, { status: 404 });

  const { byAddress } = await resolveInstitutions();
  const venue = byAddress.get(pass.institution.toLowerCase());

  return NextResponse.json({
    name: `${pass.credential.title} — Ticket #${passId}`,
    description: "A single-use ticket for a city experience.",
    attributes: [
      { trait_type: "Venue", value: venue?.name ?? pass.institution },
      { trait_type: "Status", value: pass.status === "Valid" ? "Valid" : pass.status },
      ...(pass.validUntil
        ? [
            {
              trait_type: "Valid until",
              display_type: "date",
              value: Math.floor(pass.validUntil.getTime() / 1000),
            },
          ]
        : []),
    ],
  });
}

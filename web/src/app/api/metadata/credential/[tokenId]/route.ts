import { NextResponse } from "next/server";
import { publicClient } from "@/lib/chain/client";
import { contracts } from "@/lib/chain/contracts";
import { describeCredential } from "@/lib/credentials";
import { resolveInstitutions } from "@/server/institutions";
import { isChainConfigured } from "@/lib/env";

/**
 * ERC-721 metadata for an achievement, so it renders anywhere an account is opened -- including
 * wallets and explorers this project does not control. That portability is the point.
 *
 * Note what the response does not contain: no name, no age, no school, no visit times. Only the
 * achievement and who vouched for it.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await ctx.params;

  if (!/^\d+$/.test(tokenId) || !isChainConfigured) {
    return NextResponse.json({ error: "Unknown credential" }, { status: 404 });
  }

  try {
    const credential = await publicClient().readContract({
      ...contracts.passport,
      functionName: "credentialAt",
      args: [BigInt(tokenId)],
    });
    if (!credential.exists) {
      return NextResponse.json({ error: "Unknown credential" }, { status: 404 });
    }

    const definition = describeCredential(credential.credentialType);
    const { byAddress } = await resolveInstitutions();
    const issuer = byAddress.get(credential.issuer.toLowerCase());

    return NextResponse.json({
      name: definition.title,
      description: definition.description,
      external_url: "https://cityquest.example/account",
      attributes: [
        { trait_type: "Issued by", value: issuer?.name ?? credential.issuer },
        { trait_type: "Achievement", value: definition.name },
        {
          trait_type: "Issued on",
          display_type: "date",
          value: credential.issuedAtDay * 86_400,
        },
        { trait_type: "Status", value: credential.revoked ? "Withdrawn" : "Valid" },
      ],
    });
  } catch (error) {
    console.error("[metadata] credential lookup failed", error);
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}

import { createPublicClient, defineChain, http, type PublicClient } from "viem";
import { baseSepolia } from "viem/chains";
import { publicEnv } from "@/lib/env";

/** Anvil, for local development. */
const localChain = defineChain({
  id: 31337,
  name: "Local Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});

export function activeChain() {
  if (publicEnv.chainId === baseSepolia.id) return baseSepolia;
  if (publicEnv.chainId === localChain.id) return localChain;
  return defineChain({
    id: publicEnv.chainId,
    name: `Chain ${publicEnv.chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [publicEnv.rpcUrl] } },
  });
}

let cached: PublicClient | null = null;

/** Shared read-only client. Reads are cheap and need no key. */
export function publicClient(): PublicClient {
  if (!cached) {
    cached = createPublicClient({
      chain: activeChain(),
      transport: http(publicEnv.rpcUrl),
    }) as PublicClient;
  }
  return cached;
}

export function explorerTxUrl(hash: string): string | null {
  const base = publicEnv.explorerUrl?.replace(/\/$/, "");
  return base ? `${base}/tx/${hash}` : null;
}

export function explorerAddressUrl(address: string): string | null {
  const base = publicEnv.explorerUrl?.replace(/\/$/, "");
  return base ? `${base}/address/${address}` : null;
}

"use client";

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createWalletClient, custom, type Address, type Hex } from "viem";
import { activeChain } from "@/lib/chain/client";

/**
 * The wallet abstraction layer.
 *
 * Everything the app needs from a wallet is here, and it is very little: an address, and the
 * ability to sign one sign-in message. Citizens never send transactions -- institutions sign
 * claims and a relayer submits them -- so there is no gas, no network switching and no
 * transaction confirmation anywhere in the citizen experience.
 *
 * Because the surface is this small, replacing it with passkey-based smart accounts later is a
 * change to this one file. That is the intended upgrade path; see the README.
 */

export type WalletKind = "device" | "browser";

export interface WalletAdapter {
  kind: WalletKind;
  label: string;
  /** Address if already available without prompting, otherwise null. */
  peek(): Promise<Address | null>;
  connect(): Promise<Address>;
  signMessage(message: string): Promise<Hex>;
  forget(): Promise<void>;
}

const DEVICE_KEY_STORAGE = "cityquest.device-passport-key";

/**
 * DEMO WALLET -- a key generated in the browser and kept in local storage.
 *
 * This is what makes the demo feel like an ordinary app: tapping "Create my passport" produces
 * an identity instantly, with no extension, no seed phrase and nothing to write down.
 *
 * It is not how this should ship. The key controls nothing of value -- it holds no funds and
 * cannot issue anything, it only names who an achievement belongs to -- but local storage is
 * still the wrong home for a private key, and clearing site data loses the passport. The
 * production answer is a passkey-backed smart account, where the key is held by the device
 * secure enclave and can be recovered.
 */
export class DevicePassportWallet implements WalletAdapter {
  kind: WalletKind = "device";
  label = "This device";

  private read(): Hex | null {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(DEVICE_KEY_STORAGE);
    return stored && /^0x[0-9a-fA-F]{64}$/.test(stored) ? (stored as Hex) : null;
  }

  async peek(): Promise<Address | null> {
    const key = this.read();
    return key ? privateKeyToAccount(key).address : null;
  }

  async connect(): Promise<Address> {
    let key = this.read();
    if (!key) {
      key = generatePrivateKey();
      window.localStorage.setItem(DEVICE_KEY_STORAGE, key);
    }
    return privateKeyToAccount(key).address;
  }

  async signMessage(message: string): Promise<Hex> {
    const key = this.read();
    if (!key) throw new Error("No passport on this device yet.");
    return privateKeyToAccount(key).signMessage({ message });
  }

  async forget(): Promise<void> {
    window.localStorage.removeItem(DEVICE_KEY_STORAGE);
  }
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

function injectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as { ethereum?: Eip1193Provider }).ethereum;
  return candidate ?? null;
}

/** For people who already have a wallet and would rather use it. Never required. */
export class BrowserWallet implements WalletAdapter {
  kind: WalletKind = "browser";
  label = "Browser wallet";

  async peek(): Promise<Address | null> {
    const provider = injectedProvider();
    if (!provider) return null;
    const accounts = (await provider.request({ method: "eth_accounts" })) as Address[];
    return accounts?.[0] ?? null;
  }

  async connect(): Promise<Address> {
    const provider = injectedProvider();
    if (!provider) throw new Error("No browser wallet found.");
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
    if (!accounts?.length) throw new Error("No account was shared.");
    return accounts[0];
  }

  async signMessage(message: string): Promise<Hex> {
    const provider = injectedProvider();
    if (!provider) throw new Error("No browser wallet found.");
    const address = await this.connect();
    const client = createWalletClient({ chain: activeChain(), transport: custom(provider) });
    return client.signMessage({ account: address, message });
  }

  async forget(): Promise<void> {
    // An injected wallet is disconnected from the wallet itself; nothing to clear here.
  }
}

export function hasBrowserWallet(): boolean {
  return injectedProvider() !== null;
}

export function walletFor(kind: WalletKind): WalletAdapter {
  return kind === "browser" ? new BrowserWallet() : new DevicePassportWallet();
}

const KIND_STORAGE = "cityquest.wallet-kind";

export function rememberWalletKind(kind: WalletKind): void {
  window.localStorage.setItem(KIND_STORAGE, kind);
}

export function lastWalletKind(): WalletKind {
  if (typeof window === "undefined") return "device";
  return window.localStorage.getItem(KIND_STORAGE) === "browser" ? "browser" : "device";
}

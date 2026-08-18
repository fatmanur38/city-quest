"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Address } from "viem";
import type { Profile } from "@/server/db/types";
import { lastWalletKind, rememberWalletKind, walletFor, type WalletKind } from "./wallet";

/**
 * Sign-in state for the whole app.
 *
 * "Sign in" here means: prove this city account is yours by signing a sentence. No gas, no
 * transaction, no network prompt. The result is an ordinary session cookie.
 */

interface AccountState {
  profile: Profile | null;
  address: Address | null;
  status: "loading" | "signed-out" | "signed-in";
  busy: boolean;
  error: string | null;
  signIn: (kind?: WalletKind) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({
  children,
  initialProfile,
}: {
  children: ReactNode;
  initialProfile: Profile | null;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [status, setStatus] = useState<AccountState["status"]>(
    initialProfile ? "signed-in" : "signed-out",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/session");
    const data = (await response.json()) as { profile: Profile | null };
    setProfile(data.profile);
    setStatus(data.profile ? "signed-in" : "signed-out");
  }, []);

  const signIn = useCallback(
    async (kind: WalletKind = lastWalletKind()) => {
      setBusy(true);
      setError(null);
      try {
        const wallet = walletFor(kind);
        const address = await wallet.connect();

        const challenge = await fetch("/api/auth/nonce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const challengeData = (await challenge.json()) as
          | { ok: true; nonce: string; message: string }
          | { ok: false; error: string };
        if (!challengeData.ok) throw new Error(challengeData.error);

        const signature = await wallet.signMessage(challengeData.message);

        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, nonce: challengeData.nonce, signature }),
        });
        const data = (await response.json()) as
          | { ok: true; profile: Profile }
          | { ok: false; error: string };
        if (!data.ok) throw new Error(data.error);

        rememberWalletKind(kind);
        setProfile(data.profile);
        setStatus("signed-in");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not sign in.");
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      setProfile(null);
      setStatus("signed-out");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [router]);

  // Keep the client in step when the session cookie and the page disagree, which happens after
  // signing in on another tab.
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setStatus("signed-in");
    }
  }, [initialProfile]);

  const value = useMemo<AccountState>(
    () => ({
      profile,
      address: (profile?.wallet as Address | undefined) ?? null,
      status,
      busy,
      error,
      signIn,
      signOut,
      refresh,
    }),
    [profile, status, busy, error, signIn, signOut, refresh],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used inside AccountProvider");
  return context;
}

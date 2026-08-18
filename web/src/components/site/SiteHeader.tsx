"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "@/features/auth/AccountProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/passport", label: "My Passport" },
  { href: "/activities", label: "Activities" },
  { href: "/quests", label: "Quests" },
  { href: "/tickets", label: "Tickets" },
  { href: "/rewards", label: "Rewards" },
  { href: "/leaderboard", label: "Explorers" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { profile, status, busy, signIn, signOut } = useAccount();

  return (
    <header className="sticky top-0 z-40 border-b border-border-soft/70 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-lg">🗺️</span>
          <span className="font-display text-lg font-bold tracking-tight text-ink">CityQuest</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                  active ? "bg-brand-100 text-brand-700" : "text-ink-soft hover:bg-paper-sunk",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {status === "signed-in" && profile ? (
            <>
              <Link
                href="/passport"
                className="hidden items-center gap-2 rounded-full border border-border-soft bg-paper-raised py-1 pr-3 pl-1 sm:flex"
              >
                <span className="grid size-8 place-items-center rounded-full bg-paper-sunk text-base">
                  {profile.avatarEmoji}
                </span>
                <span className="text-sm font-semibold text-ink">{profile.xp} XP</span>
              </Link>
              <Button variant="ghost" size="sm" onClick={signOut} disabled={busy}>
                Sign out
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => signIn()} disabled={busy || status === "loading"}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile navigation, since most citizens will open this on a phone in a library. */}
      <nav className="flex gap-1 overflow-x-auto border-t border-border-soft/70 px-3 py-2 md:hidden">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium",
                active ? "bg-brand-100 text-brand-700" : "text-ink-soft",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

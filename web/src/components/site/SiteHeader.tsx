"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "@/features/auth/AccountProvider";
import { useTranslations } from "@/features/i18n/LocaleProvider";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { ThemeSwitcher } from "@/features/theme/ThemeSwitcher";
import { Logo } from "@/components/site/Logo";
import type { Theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";

/**
 * `personal` links lead to pages that are only ever about you, and which greet a signed-out
 * visitor with nothing but an invitation to sign in. Showing them before there is an account
 * advertises two dead ends in a six-item bar, so they appear once there is something behind
 * them. Activities, quests, rewards and the leaderboard are the city's, not yours, and stay.
 */
const LINKS = [
  { href: "/account", key: "account", personal: true },
  { href: "/activities", key: "activities", personal: false },
  { href: "/quests", key: "quests", personal: false },
  { href: "/tickets", key: "tickets", personal: true },
  { href: "/rewards", key: "rewards", personal: false },
  { href: "/leaderboard", key: "leaderboard", personal: false },
] as const;

export function SiteHeader({ theme }: { theme: Theme }) {
  const pathname = usePathname();
  const { profile, status, busy, signIn, signOut } = useAccount();
  const { t } = useTranslations();

  // "loading" keeps them hidden too: a link that appears a beat after the page settles is more
  // jarring than one that was never there.
  const signedIn = status === "signed-in";
  const links = LINKS.filter((link) => signedIn || !link.personal);

  return (
    <header className="sticky top-0 z-40 border-b border-border-soft/70 bg-paper/85 backdrop-blur">
      {/* gap-3 on a phone: logo, theme, language and the sign-in button together overflow a
          390px viewport at gap-6, and 2px of horizontal rubber-banding is exactly the kind of
          thing that reads as "unfinished" on the device this is demonstrated on. */}
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="CityQuest">
          <Logo wordmark="sm-up" />
        </Link>

        {/* lg, not md: at exactly 768px the six links, both switchers and the sign-in button
            together are 31px wider than the viewport. The scrolling row below handles every
            width under that, and handles it better than a cramped bar would. */}
        <nav className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
          {links.map((link) => {
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
                {t.nav[link.key]}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeSwitcher initial={theme} />
          <LanguageSwitcher />
          {signedIn && profile ? (
            <>
              <Link
                href="/account"
                className="hidden items-center gap-2 rounded-full border border-border-soft bg-paper-raised py-1 pr-3 pl-1 sm:flex"
              >
                <Avatar address={profile.wallet} className="size-8 rounded-full" />
                <span className="text-sm font-semibold text-ink">{profile.xp} XP</span>
              </Link>
              <Button variant="ghost" size="sm" onClick={signOut} disabled={busy}>
                {t.nav.signOut}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => signIn()} disabled={busy || status === "loading"}>
              {busy ? t.nav.signingIn : t.nav.signIn}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile navigation, since most citizens will open this on a phone in a library. */}
      <nav className="flex gap-1 overflow-x-auto border-t border-border-soft/70 px-3 py-2 lg:hidden">
        {links.map((link) => {
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
              {t.nav[link.key]}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

import Link from "next/link";
import { getTranslations } from "@/server/locale";

export async function SiteFooter() {
  const { t } = await getTranslations();
  return (
    <footer className="mt-20 border-t border-border-soft bg-paper-sunk/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <p className="font-display text-base font-semibold text-ink">{t.footer.manifesto}</p>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">{t.footer.body}</p>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          <Link href="/activities" className="hover:text-ink">
            {t.nav.activities}
          </Link>
          <Link href="/quests" className="hover:text-ink">
            {t.nav.quests}
          </Link>
          <Link href="/leaderboard" className="hover:text-ink">
            {t.nav.leaderboard}
          </Link>
          <Link href="/institution" className="hover:text-ink">
            {t.nav.institutionStaff}
          </Link>
          <Link href="/sponsor" className="hover:text-ink">
            {t.nav.forBusinesses}
          </Link>
          <Link href="/admin" className="hover:text-ink">
            {t.nav.municipality}
          </Link>
        </div>
      </div>
    </footer>
  );
}

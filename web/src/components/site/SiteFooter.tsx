import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border-soft bg-paper-sunk/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <p className="font-display text-base font-semibold text-ink">
          If there were only one institution, we wouldn&apos;t use blockchain.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          CityQuest is a demonstration project. It runs on a test network, holds no real money,
          and stores nothing about you beyond a display name you choose.
        </p>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          <Link href="/activities" className="hover:text-ink">
            Activities
          </Link>
          <Link href="/quests" className="hover:text-ink">
            Quests
          </Link>
          <Link href="/leaderboard" className="hover:text-ink">
            Explorers
          </Link>
          <Link href="/institution" className="hover:text-ink">
            Institution staff
          </Link>
          <Link href="/admin" className="hover:text-ink">
            Municipality
          </Link>
        </div>
      </div>
    </footer>
  );
}

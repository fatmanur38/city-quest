import { currentOperator } from "@/server/session";
import { resolveInstitutions } from "@/server/institutions";
import { db } from "@/server/db";
import { AdminSignIn } from "@/features/admin/AdminSignIn";
import { AdminConsole } from "@/features/admin/AdminConsole";
import { getTranslations } from "@/server/locale";
import { ACTIVITIES } from "@/server/catalog";
import { loadPrices, priceFor } from "@/server/pricing";
import { pick } from "@/lib/i18n/types";

export async function generateMetadata() {
  const { t } = await getTranslations();
  return { title: `${t.admin.metaTitle} — CityQuest` };
}

export default async function AdminPage() {
  const operator = await currentOperator();

  if (operator !== "admin") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <AdminSignIn />
      </div>
    );
  }

  const [{ list }, { locale }, prices] = await Promise.all([
    resolveInstitutions(),
    getTranslations(),
    loadPrices(),
  ]);
  const onChain = list.filter((institution) => institution.onChain);

  // Only ticketed activities have a price. Everything else is free by design -- a library visit
  // that cost money would defeat the point of the project.
  const priceable = ACTIVITIES.filter(
    (activity) => activity.kind === "ticket",
  ).map((activity) => ({
    slug: activity.slug,
    title: pick(activity.title, locale),
    emoji: activity.emoji,
    catalogPrice: activity.priceTry ?? 0,
    currentPrice: priceFor(activity, prices),
  }));

  // Ecosystem stats. Counts only, never anything that identifies a citizen.
  const [citizens, recent] = await Promise.all([
    db().leaderboard(1000),
    db().listRecentCompletions(1000),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <AdminConsole
        institutions={onChain.map((institution) => ({
          address: institution.address ?? "",
          name: institution.name,
          kind: institution.kind,
          active: institution.active,
          emoji: institution.emoji,
        }))}
        priceable={priceable}
        stats={{
          total: onChain.length,
          active: onChain.filter((institution) => institution.active).length,
          citizens: citizens.length,
          achievements: recent.filter(
            (completion) => completion.txHash !== null,
          ).length,
        }}
      />
    </div>
  );
}

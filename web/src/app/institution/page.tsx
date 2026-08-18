import { Card } from "@/components/ui/Card";
import { currentOperator } from "@/server/session";
import { activitiesForInstitution, institutionBySlug, issuingInstitutions } from "@/server/catalog";
import { resolveInstitutions } from "@/server/institutions";
import { OperatorSignIn } from "@/features/institution/OperatorSignIn";
import { InstitutionConsole } from "@/features/institution/InstitutionConsole";
import { getTranslations } from "@/server/locale";
import { pick } from "@/lib/i18n/types";

export async function generateMetadata() {
  const { t } = await getTranslations();
  return { title: `${t.institution.metaTitle} — CityQuest` };
}

export default async function InstitutionPage() {
  const [operator, { locale, t }] = await Promise.all([currentOperator(), getTranslations()]);
  const institution = operator ? institutionBySlug(operator) : null;

  if (!institution?.isIssuer) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <OperatorSignIn
          institutions={issuingInstitutions().map((entry) => ({
            slug: entry.slug,
            name: pick(entry.label, locale),
            emoji: entry.emoji,
            kind: entry.kind,
          }))}
        />
      </div>
    );
  }

  // An institution that has been suspended in the registry should find that out here, at the
  // desk, rather than as a failed transaction in front of a visitor.
  const { bySlug } = await resolveInstitutions();
  const registered = bySlug.get(institution.slug);

  const activities = activitiesForInstitution(institution.slug).filter(
    (activity) => activity.kind === "checkin" || activity.kind === "workshop",
  );
  const sellsTickets = activitiesForInstitution(institution.slug).some(
    (activity) => activity.kind === "ticket",
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      {!registered?.onChain ? (
        <Card className="mb-6 border-danger-100 bg-danger-100/30 p-5">
          <p className="font-semibold text-danger-700">{t.institution.notRegisteredTitle}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {t.institution.notRegisteredBody}
          </p>
        </Card>
      ) : !registered.active ? (
        <Card className="mb-6 border-danger-100 bg-danger-100/30 p-5">
          <p className="font-semibold text-danger-700">{t.institution.suspendedTitle}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {t.institution.suspendedBody}
          </p>
        </Card>
      ) : null}

      <InstitutionConsole
        institutionName={pick(institution.label, locale)}
        institutionEmoji={institution.emoji}
        sellsTickets={sellsTickets}
        activities={activities.map((activity) => ({
          slug: activity.slug,
          title: pick(activity.title, locale),
          emoji: activity.emoji,
          cadence: activity.cadence,
          xpReward: activity.xpReward,
        }))}
      />
    </div>
  );
}

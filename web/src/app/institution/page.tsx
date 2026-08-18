import { Card } from "@/components/ui/Card";
import { currentOperator } from "@/server/session";
import { activitiesForInstitution, institutionBySlug, issuingInstitutions } from "@/server/catalog";
import { resolveInstitutions } from "@/server/institutions";
import { OperatorSignIn } from "@/features/institution/OperatorSignIn";
import { InstitutionConsole } from "@/features/institution/InstitutionConsole";

export const metadata = { title: "Institution console — CityQuest" };

export default async function InstitutionPage() {
  const operator = await currentOperator();
  const institution = operator ? institutionBySlug(operator) : null;

  if (!institution?.isIssuer) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <OperatorSignIn
          institutions={issuingInstitutions().map((entry) => ({
            slug: entry.slug,
            name: entry.name,
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
          <p className="font-semibold text-danger-700">Not in the city registry</p>
          <p className="mt-1 text-sm text-ink-soft">
            This institution is not registered on-chain, so any achievement it tries to issue will
            be refused. Ask the municipality to add it.
          </p>
        </Card>
      ) : !registered.active ? (
        <Card className="mb-6 border-danger-100 bg-danger-100/30 p-5">
          <p className="font-semibold text-danger-700">Currently suspended</p>
          <p className="mt-1 text-sm text-ink-soft">
            The municipality has suspended this institution. Achievements already issued remain
            valid, but new ones will be refused.
          </p>
        </Card>
      ) : null}

      <InstitutionConsole
        institutionName={institution.name}
        institutionEmoji={institution.emoji}
        sellsTickets={sellsTickets}
        activities={activities.map((activity) => ({
          slug: activity.slug,
          title: activity.title,
          emoji: activity.emoji,
          cadence: activity.cadence,
          xpReward: activity.xpReward,
        }))}
      />
    </div>
  );
}

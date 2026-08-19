import { currentSponsor } from "@/server/session";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";
import { SponsorSignIn } from "@/features/sponsor/SponsorSignIn";
import { SponsorConsole } from "@/features/sponsor/SponsorConsole";
import { CREDENTIALS } from "@/lib/credentials";
import { ACTIVITIES } from "@/server/catalog";
import { pick } from "@/lib/i18n/types";

export async function generateMetadata() {
  const { t } = await getTranslations();
  return { title: `${t.sponsor.metaTitle} — CityQuest` };
}

/**
 * Where a business joins in.
 *
 * The page a cafe owner sees is the argument for the project in miniature: they can read what a
 * library confirmed without the library having to know they exist, and they can reward it
 * without anybody minting a token.
 */
export default async function SponsorPage() {
  const [slug, { locale }] = await Promise.all([currentSponsor(), getTranslations()]);

  if (!slug) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <SponsorSignIn />
      </div>
    );
  }

  const sponsor = await db().findSponsor(slug);
  if (!sponsor) {
    // The session names a business that no longer exists. Treat it as signed out.
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6">
        <SponsorSignIn />
      </div>
    );
  }

  const offers = await db().listSponsorOffers(slug);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <SponsorConsole
        sponsorName={sponsor.name}
        sponsorIcon={sponsor.icon}
        approved={sponsor.approved}
        offers={offers}
        credentials={Object.values(CREDENTIALS).map((credential) => ({
          value: credential.name,
          label: pick(credential.title, locale),
          icon: credential.icon,
        }))}
        // Only activities a citizen can repeat are worth counting; a one-time achievement is
        // better expressed as the credential itself.
        activities={ACTIVITIES.filter((activity) => activity.cadence === "daily").map(
          (activity) => ({
            value: activity.slug,
            label: pick(activity.title, locale),
            icon: activity.icon,
          }),
        )}
      />
    </div>
  );
}

import { CircleCheck, MapPin, ScanLine, Ticket, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { VerifiedMark } from "@/components/ui/VerifiedMark";
import { BuyTicketButton } from "@/features/activities/BuyTicketButton";
import { QuizPanel } from "@/features/activities/QuizPanel";
import { ACTIVITIES, QUIZ_QUESTIONS, institutionBySlug } from "@/server/catalog";
import { loadPrices, priceFor } from "@/server/pricing";
import { currentWallet } from "@/server/session";
import { db } from "@/server/db";
import { CREDENTIALS } from "@/lib/credentials";
import { getTranslations } from "@/server/locale";
import { pick } from "@/lib/i18n/types";
import { Icon, IconTile, ACCENT_TONE } from "@/components/ui/Icon";

export async function generateMetadata() {
  const { t } = await getTranslations();
  return { title: `${t.activities.metaTitle} — CityQuest` };
}

const ACCENT_BG: Record<string, string> = {
  amber: "bg-sun-100",
  violet: "bg-violet-100",
  sky: "bg-sky-100",
  emerald: "bg-emerald-100",
};



export default async function ActivitiesPage() {
  const [wallet, { locale, t }, prices] = await Promise.all([
    currentWallet(),
    getTranslations(),
    loadPrices(),
  ]);
  const kindLabel: Record<string, string> = {
    checkin: t.activities.kindCheckin,
    ticket: t.activities.kindTicket,
    workshop: t.activities.kindWorkshop,
    quiz: t.activities.kindQuiz,
  };
  const completions = wallet ? await db().listCompletions(wallet) : [];
  const completedSlugs = new Set(completions.map((completion) => completion.activitySlug));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {t.activities.title}
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          {t.activities.lead}
        </p>
      </header>

      <div className="mt-9 space-y-5">
        {ACTIVITIES.map((activity) => {
          const institution = institutionBySlug(activity.institutionSlug);
          const credential = activity.credential ? CREDENTIALS[activity.credential] : null;
          const done = completedSlugs.has(activity.slug);

          return (
            <Card key={activity.slug} className="overflow-hidden">
              <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start">
                <IconTile
                  name={activity.icon}
                  tone={ACCENT_TONE[activity.accent] ?? "neutral"}
                  size="xl"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-ink text-balance">
                      {pick(activity.title, locale)}
                    </h2>
                    {done ? (
                      <Badge tone="emerald">
                        <CircleCheck aria-hidden />
                        {t.activities.completed}
                      </Badge>
                    ) : null}
                    {activity.cadence === "daily" ? (
                      <Badge tone="sun">{t.activities.oncePerDay}</Badge>
                    ) : null}
                  </div>

                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Icon name={institution?.icon} className="size-4 text-ink-faint" />
                      {institution ? pick(institution.label, locale) : null}
                    </span>
                    <span className="inline-flex items-center gap-1 text-ink-faint">
                      <MapPin className="size-3.5" aria-hidden />
                      {institution ? pick(institution.district, locale) : null}
                    </span>
                    <span className="inline-flex items-center gap-1 text-ink-faint">
                      {activity.kind === "ticket" ? (
                        <Ticket className="size-3.5" aria-hidden />
                      ) : (
                        <Users className="size-3.5" aria-hidden />
                      )}
                      {kindLabel[activity.kind]}
                    </span>
                  </p>

                  <p className="mt-3 max-w-prose leading-relaxed text-ink-soft text-pretty">
                    {pick(activity.description, locale)}
                  </p>

                  {/* One line, not a panel. The instructions are the same on every card, so a
                      grey box repeating them four times down the page was competing with the
                      thing that actually differs -- what you get for going. */}
                  {activity.kind === "checkin" || activity.kind === "workshop" ? (
                    <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-faint">
                      <ScanLine className="size-4 shrink-0" aria-hidden />
                      {t.activities.howToEarnBody}
                    </p>
                  ) : null}
                </div>

                {/* The reward rail. On a wide screen the long description used to trail off into
                    empty space; this puts what you earn where the eye already is. */}
                <div className="flex shrink-0 flex-col gap-3 rounded-2xl bg-paper-sunk/60 p-4 lg:w-64">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-extrabold tabular-nums text-brand-700">
                      +{activity.xpReward}
                    </span>
                    <span className="text-sm font-semibold text-ink-soft">{t.common.xp}</span>
                  </div>

                  {credential ? (
                    <div className="rounded-xl bg-paper-raised p-3">
                      <div className="flex items-center gap-2.5">
                        <IconTile name={credential.icon} tone="sun" size="sm" />
                        <p className="min-w-0 text-sm font-semibold text-ink text-balance">
                          {pick(credential.title, locale)}
                        </p>
                      </div>
                      <div className="mt-2">
                        <VerifiedMark
                          issuer={institution ? pick(institution.label, locale) : undefined}
                          label={t.common.verifiedBy}
                          fallback={t.common.verifiedInstitution}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-faint text-pretty">{t.activities.appScored}</p>
                  )}

                  {activity.kind === "ticket" ? (
                    <BuyTicketButton
                      activitySlug={activity.slug}
                      priceTry={priceFor(activity, prices)}
                      title={pick(activity.title, locale)}
                    />
                  ) : null}
                </div>
              </div>

              {activity.kind === "quiz" && QUIZ_QUESTIONS[activity.slug] ? (
                <div className="border-t border-border-soft bg-paper-sunk/40 p-6">
                  <QuizPanel
                    activitySlug={activity.slug}
                    xpReward={activity.xpReward}
                    questions={QUIZ_QUESTIONS[activity.slug].map(({ id, question, options }) => ({
                      id,
                      question: pick(question, locale),
                      options: options.map((option) => pick(option, locale)),
                    }))}
                  />
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

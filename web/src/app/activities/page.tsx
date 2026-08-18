import { MapPin, Ticket, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { VerifiedMark } from "@/components/ui/VerifiedMark";
import { BuyTicketButton } from "@/features/activities/BuyTicketButton";
import { QuizPanel } from "@/features/activities/QuizPanel";
import { ACTIVITIES, QUIZ_QUESTIONS, institutionBySlug } from "@/server/catalog";
import { currentWallet } from "@/server/session";
import { db } from "@/server/db";
import { CREDENTIALS } from "@/lib/credentials";
import { getTranslations } from "@/server/locale";
import { pick } from "@/lib/i18n/types";

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
  const [wallet, { locale, t }] = await Promise.all([currentWallet(), getTranslations()]);
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
              <div className="flex flex-col gap-6 p-6 sm:flex-row">
                <span
                  className={`grid size-16 shrink-0 place-items-center rounded-2xl text-4xl ${
                    ACCENT_BG[activity.accent] ?? "bg-paper-sunk"
                  }`}
                >
                  {activity.emoji}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-bold text-ink">
                      {pick(activity.title, locale)}
                    </h2>
                    {done ? <Badge tone="emerald">{t.activities.completed}</Badge> : null}
                    {activity.cadence === "daily" ? <Badge tone="sun">{t.activities.oncePerDay}</Badge> : null}
                  </div>

                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span aria-hidden>{institution?.emoji}</span>
                      {institution ? pick(institution.label, locale) : null}
                    </span>
                    <span className="inline-flex items-center gap-1 text-ink-faint">
                      <MapPin className="size-3.5" aria-hidden />
                      {institution ? pick(institution.district, locale) : null}
                    </span>
                  </p>

                  <p className="mt-3 leading-relaxed text-ink-soft">
                    {pick(activity.description, locale)}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge tone="brand">+{activity.xpReward} XP</Badge>
                    <Badge tone="neutral">
                      {activity.kind === "ticket" ? (
                        <Ticket className="size-3.5" aria-hidden />
                      ) : (
                        <Users className="size-3.5" aria-hidden />
                      )}
                      {kindLabel[activity.kind]}
                    </Badge>
                    {credential ? (
                      <Badge tone="sun">
                        {credential.emoji} {pick(credential.title, locale)}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    {activity.kind === "ticket" ? (
                      <BuyTicketButton
                        activitySlug={activity.slug}
                        priceTry={activity.priceTry ?? 0}
                        title={pick(activity.title, locale)}
                      />
                    ) : activity.kind === "quiz" ? null : (
                      <div className="rounded-2xl bg-paper-sunk p-4">
                        <p className="text-sm font-semibold text-ink">
                          {t.activities.howToEarn}
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">{t.activities.howToEarnBody}</p>
                        <div className="mt-3">
                          <VerifiedMark
                            issuer={institution ? pick(institution.label, locale) : undefined}
                            label={t.common.verifiedBy}
                            fallback={t.common.verifiedInstitution}
                          />
                        </div>
                      </div>
                    )}
                  </div>
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

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

export const metadata = { title: "Activities — CityQuest" };

const ACCENT_BG: Record<string, string> = {
  amber: "bg-sun-100",
  violet: "bg-violet-100",
  sky: "bg-sky-100",
  emerald: "bg-emerald-100",
};

const KIND_LABEL: Record<string, string> = {
  checkin: "Drop in any day",
  ticket: "Ticket required",
  workshop: "Scheduled workshop",
  quiz: "Take it from home",
};

export default async function ActivitiesPage() {
  const wallet = await currentWallet();
  const completions = wallet ? await db().listCompletions(wallet) : [];
  const completedSlugs = new Set(completions.map((completion) => completion.activitySlug));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Things to do in the city
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Every activity below is hosted by an institution that will confirm you were there. The
          quiz is the exception — the city app scores that one itself.
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
                    <h2 className="font-display text-xl font-bold text-ink">{activity.title}</h2>
                    {done ? <Badge tone="emerald">Completed</Badge> : null}
                    {activity.cadence === "daily" ? <Badge tone="sun">Once per day</Badge> : null}
                  </div>

                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span aria-hidden>{institution?.emoji}</span>
                      {institution?.name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-ink-faint">
                      <MapPin className="size-3.5" aria-hidden />
                      {institution?.district}
                    </span>
                  </p>

                  <p className="mt-3 leading-relaxed text-ink-soft">{activity.description}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge tone="brand">+{activity.xpReward} XP</Badge>
                    <Badge tone="neutral">
                      {activity.kind === "ticket" ? (
                        <Ticket className="size-3.5" aria-hidden />
                      ) : (
                        <Users className="size-3.5" aria-hidden />
                      )}
                      {KIND_LABEL[activity.kind]}
                    </Badge>
                    {credential ? (
                      <Badge tone="sun">
                        {credential.emoji} {credential.title}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    {activity.kind === "ticket" ? (
                      <BuyTicketButton
                        activitySlug={activity.slug}
                        priceTry={activity.priceTry ?? 0}
                        title={activity.title}
                      />
                    ) : activity.kind === "quiz" ? null : (
                      <div className="rounded-2xl bg-paper-sunk p-4">
                        <p className="text-sm font-semibold text-ink">How to earn this</p>
                        <p className="mt-1 text-sm text-ink-soft">
                          Open your passport, tap <strong>Show my code</strong>, and let a member
                          of staff scan it.
                        </p>
                        <div className="mt-3">
                          <VerifiedMark issuer={institution?.name} />
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
                      question,
                      options,
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

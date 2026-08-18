import Link from "next/link";
import { BadgeCheck, Building2, KeyRound, Shield, Ticket, Users } from "lucide-react";
import { SignInButton } from "@/features/auth/SignInButton";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ACTIVITIES, INSTITUTIONS, institutionBySlug } from "@/server/catalog";

const ACCENTS: Record<string, string> = {
  amber: "bg-sun-100",
  violet: "bg-violet-100",
  sky: "bg-sky-100",
  emerald: "bg-emerald-100",
};

export default function LandingPage() {
  return (
    <>
      {/* ------------------------------------------------------------------ Hero */}
      <section className="paper-grain">
        <div className="mx-auto w-full max-w-6xl px-4 pt-14 pb-20 sm:px-6 lg:pt-20">
          <div className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="animate-rise">
              <span className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-paper-raised px-3 py-1.5 text-xs font-semibold text-ink-soft">
                <span className="size-2 rounded-full bg-brand-500" aria-hidden />
                A learning passport for Konya
              </span>

              <h1 className="mt-6 font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance text-ink sm:text-5xl lg:text-[2.9rem]">
                Explore your city.
                <br />
                Learn something new.
                <br />
                <span className="text-brand-600">Build a passport of experiences.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
                Visit libraries, science centers, museums and workshops. Each one confirms what
                you did, in a way anybody can check later — and the record belongs to you, not to
                whoever built the app.
              </p>

              <div className="mt-9 flex flex-wrap items-start gap-4">
                <SignInButton />
                <ButtonLink href="/activities" variant="secondary" size="lg">
                  Explore Activities
                </ButtonLink>
              </div>
            </div>

            {/* A passport that looks like a passport, not a wallet. */}
            <div className="animate-rise lg:justify-self-end" style={{ animationDelay: "80ms" }}>
              <Card className="w-full max-w-sm overflow-hidden">
                <div className="perforation h-2.5 w-full" />
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">
                        City Learning Passport
                      </p>
                      <p className="mt-1 font-display text-xl font-bold text-ink">Elif&apos;s Passport</p>
                    </div>
                    <span className="grid size-12 place-items-center rounded-2xl bg-paper-sunk text-2xl">
                      🦊
                    </span>
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-700">
                      Level 4
                    </span>
                    <span className="text-sm font-semibold text-ink-soft">860 XP</span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {[
                      { emoji: "📚", title: "Library Visitor", issuer: "Selcuklu Library" },
                      { emoji: "🌍", title: "Earthquake Experience", issuer: "Konya Science Center" },
                      { emoji: "🏆", title: "Young Scientist", issuer: "Konya Municipality" },
                    ].map((item) => (
                      <li
                        key={item.title}
                        className="flex items-center gap-3 rounded-2xl bg-paper-sunk/70 p-3"
                      >
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper-raised text-xl shadow-soft">
                          {item.emoji}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-brand-700">
                            <BadgeCheck className="size-3.5 shrink-0" aria-hidden />
                            {item.issuer}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- The argument, stated plainly */}
      <section className="border-y border-border-soft bg-brand-900">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:px-6 lg:py-20">
          <p className="font-display text-2xl leading-tight font-extrabold text-white sm:text-4xl">
            &ldquo;If there were only one institution,
            <br className="hidden sm:block" /> we wouldn&apos;t use blockchain.&rdquo;
          </p>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-brand-100 sm:text-lg">
            Libraries, science centers, museums, universities and municipalities can independently
            issue achievements that belong to you.
          </p>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-brand-300">
            We are not using a blockchain because it is fashionable, or to create a coin. We use it
            because these institutions are independent of one another, and a student&apos;s record
            should not be locked inside whichever organisation happened to build the software.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {INSTITUTIONS.map((institution) => (
              <span
                key={institution.slug}
                className="inline-flex items-center gap-2 rounded-full bg-brand-700/60 px-3.5 py-2 text-sm font-medium text-brand-100"
              >
                <span aria-hidden>{institution.emoji}</span>
                {institution.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- How it works */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink">How it works</h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Three steps, and none of them involve knowing anything about cryptography.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Users,
              title: "Show your passport",
              body: "At the desk, show the code on your phone. It changes every time and means nothing on its own.",
            },
            {
              icon: Building2,
              title: "The institution confirms it",
              body: "A librarian or an instructor confirms you were there. Their signature is what makes the achievement real.",
            },
            {
              icon: BadgeCheck,
              title: "It is yours to keep",
              body: "The achievement lands in your passport, and any other institution can check it — even years later.",
            },
          ].map((step, index) => (
            <Card key={step.title} className="p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <span className="font-display text-sm font-bold text-ink-faint">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- Activities preview */}
      <section className="border-y border-border-soft bg-paper-sunk/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-ink">
                What&apos;s happening in the city
              </h2>
              <p className="mt-3 max-w-2xl text-ink-soft">
                Every activity is hosted by a real institution that stands behind it.
              </p>
            </div>
            <ButtonLink href="/activities" variant="secondary">
              See all activities
            </ButtonLink>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ACTIVITIES.map((activity) => {
              const institution = institutionBySlug(activity.institutionSlug);
              return (
                <Link key={activity.slug} href="/activities" className="group">
                  <Card className="h-full p-5 transition-shadow group-hover:shadow-lift">
                    <span
                      className={`grid size-12 place-items-center rounded-2xl text-2xl ${
                        ACCENTS[activity.accent] ?? "bg-paper-sunk"
                      }`}
                    >
                      {activity.emoji}
                    </span>
                    <p className="mt-4 text-xs font-semibold text-ink-faint">
                      {institution?.name}
                    </p>
                    <h3 className="mt-1 font-display text-base font-semibold text-ink">
                      {activity.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{activity.summary}</p>
                    <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-700">
                      +{activity.xpReward} XP
                      {activity.kind === "ticket" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint">
                          <Ticket className="size-3.5" aria-hidden />
                          Ticket required
                        </span>
                      ) : null}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------- Privacy */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700">
              <Shield className="size-3.5" aria-hidden />
              Built for children too
            </span>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-ink">
              What we record, and what we refuse to
            </h2>
            <p className="mt-4 leading-relaxed text-ink-soft">
              Some of the people using this are eleven years old. A permanent public record of
              where a child goes after school would be an unacceptable thing to build, so we
              didn&apos;t build one.
            </p>
            <p className="mt-4 leading-relaxed text-ink-soft">
              An achievement says what was earned and who vouched for it. It does not say when you
              arrived, how long you stayed, or how often you go.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-brand-700">
                <KeyRound className="size-4" aria-hidden />
                On the shared registry
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                <li>Which achievement you hold</li>
                <li>Which institution vouched for it</li>
                <li>Roughly when it was earned</li>
                <li>Whether it is still valid</li>
              </ul>
            </Card>

            <Card className="border-danger-100 bg-danger-100/25 p-5">
              <p className="text-sm font-bold text-danger-700">Never recorded publicly</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                <li>Your name, age or school</li>
                <li>Your phone number or email</li>
                <li>The time you arrived or left</li>
                <li>Where you were, minute by minute</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <Card className="overflow-hidden bg-brand-600 p-10 text-center sm:p-14">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Start your City Passport
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-brand-100">
            It takes one tap. Your first achievement is waiting at the library.
          </p>
          <div className="mt-8 flex justify-center">
            <div className="[&_p]:text-brand-100 [&_button]:bg-white [&_button]:text-brand-700 hover:[&_button]:bg-brand-50">
              <SignInButton />
            </div>
          </div>
        </Card>
      </section>
    </>
  );
}

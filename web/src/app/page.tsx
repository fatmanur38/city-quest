import Link from "next/link";
import { BadgeCheck, Building2, KeyRound, Shield, Ticket, Users } from "lucide-react";
import { SignInButton } from "@/features/auth/SignInButton";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ACTIVITIES, INSTITUTIONS, institutionBySlug } from "@/server/catalog";
import { getTranslations } from "@/server/locale";
import { pick } from "@/lib/i18n/types";

const ACCENTS: Record<string, string> = {
  amber: "bg-sun-100",
  violet: "bg-violet-100",
  sky: "bg-sky-100",
  emerald: "bg-emerald-100",
};

export default async function LandingPage() {
  const { locale, t } = await getTranslations();

  return (
    <>
      {/* ------------------------------------------------------------------ Hero */}
      <section className="paper-grain">
        <div className="mx-auto w-full max-w-6xl px-4 pt-14 pb-20 sm:px-6 lg:pt-20">
          <div className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="animate-rise">
              <span className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-paper-raised px-3 py-1.5 text-xs font-semibold text-ink-soft">
                <span className="size-2 rounded-full bg-brand-500" aria-hidden />
                {t.landing.eyebrow}
              </span>

              <h1 className="mt-6 font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance text-ink sm:text-5xl lg:text-[2.9rem]">
                {t.landing.headlineLine1}
                <br />
                {t.landing.headlineLine2}
                <br />
                <span className="text-brand-600">{t.landing.headlineLine3}</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
                {t.landing.subtitle}
              </p>

              <div className="mt-9 flex flex-wrap items-start gap-4">
                <SignInButton />
                <ButtonLink href="/activities" variant="secondary" size="lg">
                  {t.landing.exploreActivities}
                </ButtonLink>
              </div>
            </div>

            {/* An account card that looks like a membership card, not a wallet. */}
            <div className="animate-rise lg:justify-self-end" style={{ animationDelay: "80ms" }}>
              <Card className="w-full max-w-sm overflow-hidden">
                <div className="perforation h-2.5 w-full" />
                <div className="p-6">
                  {/* min-w-0 and shrink-0: the Turkish labels are long enough to slide under
                      the avatar without them. */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase">
                        {t.account.documentLabel}
                      </p>
                      <p className="mt-1 truncate font-display text-xl font-bold text-ink">
                        {t.landing.sampleAccountOwner}
                      </p>
                    </div>
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-paper-sunk text-2xl">
                      🦊
                    </span>
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-bold text-brand-700">
                      {t.common.level} 4
                    </span>
                    <span className="text-sm font-semibold text-ink-soft">860 XP</span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {t.landing.sampleCredentials.map((item) => (
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
      <section className="border-y border-border-soft bg-brand-band">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:px-6 lg:py-20">
          <p className="font-display text-2xl leading-tight font-extrabold text-on-band sm:text-4xl">
            {t.landing.manifesto}
          </p>

          <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-on-band-soft sm:text-lg">
            {t.landing.manifestoBody}
          </p>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-on-band-faint">
            {t.landing.manifestoDetail}
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {INSTITUTIONS.map((institution) => (
              <span
                key={institution.slug}
                className="inline-flex items-center gap-2 rounded-full bg-band-chip px-3.5 py-2 text-sm font-medium text-on-band-soft"
              >
                <span aria-hidden>{institution.emoji}</span>
                {pick(institution.label, locale)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- How it works */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink">
          {t.landing.howItWorks}
        </h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          {t.landing.howItWorksLead}
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { icon: Users, title: t.landing.step1Title, body: t.landing.step1Body },
            { icon: Building2, title: t.landing.step2Title, body: t.landing.step2Body },
            { icon: BadgeCheck, title: t.landing.step3Title, body: t.landing.step3Body },
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
                {t.landing.whatsHappening}
              </h2>
              <p className="mt-3 max-w-2xl text-ink-soft">
                {t.landing.whatsHappeningLead}
              </p>
            </div>
            <ButtonLink href="/activities" variant="secondary">
              {t.landing.seeAllActivities}
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
                      {institution ? pick(institution.label, locale) : null}
                    </p>
                    <h3 className="mt-1 font-display text-base font-semibold text-ink">
                      {pick(activity.title, locale)}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-ink-soft">
                      {pick(activity.summary, locale)}
                    </p>
                    <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-700">
                      +{activity.xpReward} XP
                      {activity.kind === "ticket" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint">
                          <Ticket className="size-3.5" aria-hidden />
                          {t.landing.ticketRequired}
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
              {t.landing.privacyBadge}
            </span>
            <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-ink">
              {t.landing.privacyTitle}
            </h2>
            <p className="mt-4 leading-relaxed text-ink-soft">
              {t.landing.privacyBody1}
            </p>
            <p className="mt-4 leading-relaxed text-ink-soft">
              {t.landing.privacyBody2}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="flex items-center gap-2 text-sm font-bold text-brand-700">
                <KeyRound className="size-4" aria-hidden />
                {t.landing.onRegistry}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                {t.landing.onRegistryItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>

            <Card className="border-danger-100 bg-danger-100/25 p-5">
              <p className="text-sm font-bold text-danger-700">{t.landing.neverRecorded}</p>
              <ul className="mt-3 space-y-2 text-sm text-ink-soft">
                {t.landing.neverRecordedItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------------- CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <Card className="overflow-hidden bg-brand-600 p-10 text-center sm:p-14">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-on-brand sm:text-4xl">
            {t.landing.ctaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-on-band-soft">
            {t.landing.ctaBody}
          </p>
          <div className="mt-8 flex justify-center">
            <div className="[&_p]:text-on-band-soft [&_button]:bg-on-brand [&_button]:text-brand-ink hover:[&_button]:bg-brand-tint">
              <SignInButton />
            </div>
          </div>
        </Card>
      </section>
    </>
  );
}

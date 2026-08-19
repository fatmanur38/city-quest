"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Gift, LogOut, ShieldCheck, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useTranslations } from "@/features/i18n/LocaleProvider";
import type { OfferRequirement, SponsorOffer } from "@/server/db/types";
import { cn } from "@/lib/cn";

export interface OfferChoice {
  value: string;
  label: string;
}

/**
 * What a business does here, and what it deliberately cannot.
 *
 * It publishes an offer and says what a student must already have done to earn it. It cannot
 * confirm a visit, cannot issue an achievement and cannot take one away -- those belong to the
 * institutions, and the registry contract enforces that regardless of what this screen does.
 */
export function SponsorConsole({
  sponsorName,
  sponsorEmoji,
  approved,
  offers,
  credentials,
  activities,
}: {
  sponsorName: string;
  sponsorEmoji: string;
  approved: boolean;
  offers: SponsorOffer[];
  credentials: OfferChoice[];
  activities: OfferChoice[];
}) {
  const router = useRouter();
  const { t } = useTranslations();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🎁");
  const [kind, setKind] = useState<OfferRequirement["kind"]>("credential");
  const [credential, setCredential] = useState(credentials[0]?.value ?? "");
  const [activitySlug, setActivitySlug] = useState(activities[0]?.value ?? "");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const requirement: OfferRequirement =
        kind === "credential"
          ? { kind: "credential", credential }
          : { kind: "visits", activitySlug, count };

      const response = await fetch("/api/sponsor/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, emoji, requirement }),
      });
      const data = (await response.json()) as { ok: true } | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      setTitle("");
      setDescription("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.common.couldNotReach);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(slug: string, active: boolean) {
    await fetch("/api/sponsor/offers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, active }),
    });
    router.refresh();
  }

  async function signOut() {
    await fetch("/api/sponsor/session", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-paper-sunk text-2xl">
            {sponsorEmoji}
          </span>
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
              {t.sponsor.console}
            </p>
            <h1 className="font-display text-xl font-bold text-ink">{sponsorName}</h1>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
          <LogOut className="size-4" aria-hidden />
          {t.nav.signOut}
        </Button>
      </div>

      {!approved ? (
        <Card className="flex items-start gap-3 bg-sun-100 p-5">
          <Timer className="size-5 shrink-0 text-sun-700" aria-hidden />
          <div>
            <p className="font-display font-bold text-ink">{t.sponsor.pendingTitle}</p>
            <p className="mt-1 text-sm text-ink-soft">{t.sponsor.pendingBody}</p>
          </div>
        </Card>
      ) : null}

      {/* Existing offers */}
      <Card className="p-6">
        <CardHeader title={t.sponsor.offers} description={t.sponsor.offersLead} />
        {offers.length === 0 ? (
          <p className="mt-5 text-sm text-ink-faint">{t.sponsor.noOffers}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border-soft">
            {offers.map((offer) => (
              <li key={offer.slug} className="flex flex-wrap items-center gap-3 py-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper-sunk text-xl">
                  {offer.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {offer.title}
                    <Badge tone={offer.active ? "emerald" : "danger"}>
                      {offer.active ? t.sponsor.live : t.sponsor.hidden}
                    </Badge>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                    {offer.requirement.kind === "credential" ? (
                      <ShieldCheck className="size-3.5 shrink-0 text-brand-700" aria-hidden />
                    ) : null}
                    {offer.requirement.kind === "credential"
                      ? t.sponsor.verifiedOnChain
                      : t.sponsor.countedByApp}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toggle(offer.slug, !offer.active)}
                  className="gap-1.5"
                >
                  {offer.active ? (
                    <>
                      <EyeOff className="size-3.5" aria-hidden />
                      {t.sponsor.deactivate}
                    </>
                  ) : (
                    <>
                      <Eye className="size-3.5" aria-hidden />
                      {t.sponsor.activate}
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* New offer */}
      <Card className="p-6">
        <CardHeader title={t.sponsor.newOffer} description={t.sponsor.newOfferLead} />

        <div className="mt-5 grid gap-4 sm:grid-cols-[5rem_1fr]">
          <label>
            <span className="text-sm font-semibold text-ink">{t.sponsor.offerEmoji}</span>
            <input
              value={emoji}
              onChange={(event) => setEmoji(event.target.value)}
              className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 text-center text-lg focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label>
            <span className="text-sm font-semibold text-ink">{t.sponsor.offerTitle}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t.sponsor.offerTitlePlaceholder}
              className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-ink">{t.sponsor.offerDescription}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t.sponsor.offerDescriptionPlaceholder}
            rows={2}
            className="mt-2 w-full rounded-2xl border border-border-soft bg-paper-raised px-4 py-3 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-ink">{t.sponsor.requirement}</legend>
          <div className="mt-3 flex gap-2">
            {(["credential", "visits"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={cn(
                  "flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors",
                  kind === option
                    ? "border-brand-500 bg-brand-100 text-brand-700"
                    : "border-border-soft bg-paper-raised text-ink-soft",
                )}
              >
                {option === "credential"
                  ? t.sponsor.requirementCredential
                  : t.sponsor.requirementVisits}
              </button>
            ))}
          </div>

          {/* The honest part: say which of the two the business can check for itself. */}
          <p className="mt-3 rounded-xl bg-paper-sunk px-3 py-2 text-xs text-ink-soft">
            {kind === "credential" ? t.sponsor.verifiedOnChainBody : t.sponsor.countedByAppBody}
          </p>

          {kind === "credential" ? (
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-ink">{t.sponsor.whichAchievement}</span>
              <select
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 text-sm focus:border-brand-500 focus:outline-none"
              >
                {credentials.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_8rem]">
              <label>
                <span className="text-sm font-semibold text-ink">{t.sponsor.whichActivity}</span>
                <select
                  value={activitySlug}
                  onChange={(event) => setActivitySlug(event.target.value)}
                  className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 text-sm focus:border-brand-500 focus:outline-none"
                >
                  {activities.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-semibold text-ink">{t.sponsor.requirementCount}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                  className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 text-sm focus:border-brand-500 focus:outline-none"
                />
              </label>
            </div>
          )}
        </fieldset>

        {error ? <p className="mt-4 text-sm font-medium text-danger-700">{error}</p> : null}

        <Button className="mt-6 gap-2" onClick={publish} disabled={busy || title.trim() === ""}>
          <Gift className="size-4" aria-hidden />
          {busy ? t.sponsor.publishing : t.sponsor.publish}
        </Button>
      </Card>
    </div>
  );
}

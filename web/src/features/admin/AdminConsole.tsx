"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, LogOut, Power, PowerOff, Store, TicketPercent, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TechnicalDetails } from "@/components/ui/TechnicalDetails";
import {
  INSTITUTION_TYPES,
  institutionTypeLabel,
  type InstitutionTypeName,
} from "@/lib/chain/contracts";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/chain/client";
import { useTranslations } from "@/features/i18n/LocaleProvider";

export interface PriceableActivity {
  slug: string;
  title: string;
  emoji: string;
  /** What src/server/catalog.ts ships with, shown so a change can be undone. */
  catalogPrice: number;
  /** What is actually charged today. */
  currentPrice: number;
}

export interface AdminSponsor {
  slug: string;
  name: string;
  emoji: string;
  accessCode: string;
  approved: boolean;
  offerCount: number;
}

export interface AdminInstitution {
  address: string;
  name: string;
  kind: string;
  active: boolean;
  emoji: string;
}

/**
 * One row of the price list.
 *
 * Local state per row rather than one shared map: two rows are never edited at once, and this
 * way a failed save cannot leave a different row showing a value that was never stored.
 */
function PriceRow({ activity }: { activity: PriceableActivity }) {
  const router = useRouter();
  const { t } = useTranslations();
  const [value, setValue] = useState(String(activity.currentPrice));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overridden = activity.currentPrice !== activity.catalogPrice;
  const dirty = value.trim() !== String(activity.currentPrice);

  async function save(priceTry: number | null) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/admin/prices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activitySlug: activity.slug, priceTry }),
      });
      const data = (await response.json()) as
        { ok: true; priceTry: number } | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      setValue(String(data.priceTry));
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the price.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper-sunk text-xl">
        {activity.emoji}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{activity.title}</p>
        <p className="mt-0.5 text-xs text-ink-faint">
          {overridden ? t.admin.priceCatalogue(activity.catalogPrice) : null}
          {saved && !error ? (
            <span className="text-brand-700">
              {overridden ? " · " : ""}
              {t.admin.priceSaved}
            </span>
          ) : null}
          {error ? <span className="text-danger-700">{error}</span> : null}
        </p>
      </div>

      <label className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="h-10 w-24 rounded-full border border-border-soft bg-paper-raised px-3 text-right text-sm focus:border-brand-500 focus:outline-none"
        />
        <span className="text-sm font-semibold text-ink-soft">TL</span>
      </label>

      <Button
        size="sm"
        onClick={() => save(Number(value))}
        disabled={busy || !dirty || value.trim() === "" || Number(value) < 0}
      >
        {busy ? t.admin.priceSaving : t.admin.priceSave}
      </Button>

      {overridden ? (
        <Button variant="ghost" size="sm" onClick={() => save(null)} disabled={busy}>
          {t.admin.priceReset}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The municipality's console.
 *
 * Everything here writes to the registry contract, which is deliberately the one place in the
 * system with a central authority: somebody has to decide that a given address really is the
 * city library. Note what this power does not include -- the municipality can stop an
 * institution from issuing anything new, but it cannot forge an achievement in that
 * institution's name, and it cannot quietly delete one a citizen already holds.
 */
export function AdminConsole({
  institutions,
  sponsors,
  priceable,
  stats,
}: {
  institutions: AdminInstitution[];
  sponsors: AdminSponsor[];
  priceable: PriceableActivity[];
  stats: {
    total: number;
    active: number;
    citizens: number;
    achievements: number;
  };
}) {
  const router = useRouter();
  const { t } = useTranslations();
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<InstitutionTypeName>("Library");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorEmoji, setSponsorEmoji] = useState("🏪");

  async function addSponsor() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/sponsors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sponsorName, emoji: sponsorEmoji }),
      });
      const data = (await response.json()) as { ok: true } | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      setSponsorName("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the business.");
    } finally {
      setBusy(false);
    }
  }

  async function setSponsorApproved(slug: string, approved: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/sponsors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, approved }),
      });
      const data = (await response.json()) as { ok: true } | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the business.");
    } finally {
      setBusy(false);
    }
  }

  async function registerInstitution() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, name, kind }),
      });
      const data = (await response.json()) as
        { ok: true; txHash: string } | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      setLastTx(data.txHash);
      setAddress("");
      setName("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.admin.couldNotRegister);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(institutionAddress: string, active: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/institutions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: institutionAddress, active }),
      });
      const data = (await response.json()) as
        { ok: true; txHash: string } | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      setLastTx(data.txHash);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.admin.couldNotUpdate);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
            {t.nav.municipality}
          </p>
          <h1 className="font-display text-2xl font-bold text-ink">{t.admin.cityRegistry}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
          <LogOut className="size-4" aria-hidden />
          {t.nav.signOut}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: t.admin.statInstitutions, value: stats.total },
          { label: t.admin.statActive, value: stats.active },
          { label: t.admin.statCitizens, value: stats.citizens },
          { label: t.admin.statAchievements, value: stats.achievements },
        ].map((stat) => (
          <Card key={stat.label} className="p-5">
            <p className="text-xs font-semibold text-ink-faint">{stat.label}</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-ink">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Register */}
      <Card className="p-6">
        <CardHeader title={t.admin.authorise} description={t.admin.authoriseLead} />

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold text-ink">{t.admin.institutionAddress}</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="0x…"
              className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 font-mono text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-ink">{t.admin.publicName}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Meram Library"
              className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>

          <label>
            <span className="text-sm font-semibold text-ink">{t.admin.type}</span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as InstitutionTypeName)}
              className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 text-sm focus:border-brand-500 focus:outline-none"
            >
              {INSTITUTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t.common.institutionTypes[type] ?? institutionTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p className="mt-3 text-sm font-medium text-danger-700">{error}</p> : null}

        <Button
          className="mt-5 gap-2"
          onClick={registerInstitution}
          disabled={busy || !/^0x[a-fA-F0-9]{40}$/.test(address) || name.trim().length === 0}
        >
          <Building2 className="size-4" aria-hidden />
          {busy ? t.admin.writing : t.admin.authoriseButton}
        </Button>

        {lastTx ? (
          <TechnicalDetails className="mt-4" txHash={lastTx} explorerUrl={explorerTxUrl(lastTx)} />
        ) : null}
      </Card>

      {/* List */}
      <Card className="p-6">
        <CardHeader title={t.admin.registered} description={t.admin.registeredLead} />

        <ul className="mt-5 divide-y divide-border-soft">
          {institutions.map((institution) => (
            <li key={institution.address} className="flex flex-wrap items-center gap-3 py-4">
              <span className="grid size-10 place-items-center rounded-xl bg-paper-sunk text-xl">
                {institution.emoji}
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {institution.name}
                  <Badge tone={institution.active ? "emerald" : "danger"}>
                    {institution.active ? t.admin.active : t.admin.suspended}
                  </Badge>
                </p>
                <a
                  href={explorerAddressUrl(institution.address) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block truncate font-mono text-xs text-ink-faint hover:text-ink-soft"
                >
                  {institution.address}
                </a>
              </div>

              <Button
                variant={institution.active ? "secondary" : "primary"}
                size="sm"
                disabled={busy}
                onClick={() => toggle(institution.address, !institution.active)}
                className="gap-1.5"
              >
                {institution.active ? (
                  <>
                    <PowerOff className="size-3.5" aria-hidden />
                    {t.admin.suspend}
                  </>
                ) : (
                  <>
                    <Power className="size-3.5" aria-hidden />
                    {t.admin.reactivate}
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {/*
       * Businesses.
       *
       * Nothing here writes to a contract, and that is the honest boundary: an institution's
       * authority to issue achievements is a public fact anyone can check, while a cafe's offer
       * is a private commercial decision that needs no such guarantee.
       */}
      <Card className="p-6">
        <CardHeader title={t.admin.businesses} description={t.admin.businessesLead} />

        <div className="mt-5 grid gap-4 sm:grid-cols-[5rem_1fr_auto] sm:items-end">
          <label>
            <span className="text-sm font-semibold text-ink">{t.sponsor.offerEmoji}</span>
            <input
              value={sponsorEmoji}
              onChange={(event) => setSponsorEmoji(event.target.value)}
              className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 text-center text-lg focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label>
            <span className="text-sm font-semibold text-ink">{t.admin.businessName}</span>
            <input
              value={sponsorName}
              onChange={(event) => setSponsorName(event.target.value)}
              placeholder={t.admin.businessNamePlaceholder}
              className="mt-2 h-11 w-full rounded-full border border-border-soft bg-paper-raised px-4 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <Button
            className="gap-2"
            onClick={addSponsor}
            disabled={busy || sponsorName.trim().length === 0}
          >
            <Store className="size-4" aria-hidden />
            {t.admin.addBusiness}
          </Button>
        </div>

        {sponsors.length === 0 ? (
          <p className="mt-5 text-sm text-ink-faint">{t.admin.noBusinesses}</p>
        ) : (
          <ul className="mt-5 divide-y divide-border-soft">
            {sponsors.map((sponsor) => (
              <li key={sponsor.slug} className="flex flex-wrap items-center gap-3 py-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper-sunk text-xl">
                  {sponsor.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {sponsor.name}
                    <Badge tone={sponsor.approved ? "emerald" : "neutral"}>
                      {sponsor.approved ? t.admin.approved : t.admin.awaitingApproval}
                    </Badge>
                    <Badge tone="brand">{t.admin.offerCount(sponsor.offerCount)}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {t.admin.businessCode}:{" "}
                    <code className="font-mono font-semibold text-ink-soft">
                      {sponsor.accessCode}
                    </code>{" "}
                    — {t.admin.businessCodeHint}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setSponsorApproved(sponsor.slug, !sponsor.approved)}
                  disabled={busy}
                >
                  {sponsor.approved ? (
                    <>
                      <X className="size-3.5" aria-hidden />
                      {t.admin.unapprove}
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" aria-hidden />
                      {t.admin.approve}
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Prices. The only figures in the system that are not on the chain, on purpose. */}
      <Card className="p-6">
        <CardHeader title={t.admin.prices} description={t.admin.pricesLead} />

        {priceable.length === 0 ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-ink-faint">
            <TicketPercent className="size-4 shrink-0" aria-hidden />
            {t.admin.priceNone}
          </p>
        ) : (
          <div className="mt-3 divide-y divide-border-soft">
            {priceable.map((activity) => (
              <PriceRow key={activity.slug} activity={activity} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

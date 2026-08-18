"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogOut, Power, PowerOff } from "lucide-react";
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

export interface AdminInstitution {
  address: string;
  name: string;
  kind: string;
  active: boolean;
  emoji: string;
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
  stats,
}: {
  institutions: AdminInstitution[];
  stats: { total: number; active: number; citizens: number; achievements: number };
}) {
  const router = useRouter();
  const { t } = useTranslations();
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<InstitutionTypeName>("Library");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

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
        | { ok: true; txHash: string }
        | { ok: false; error: string };
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
        | { ok: true; txHash: string }
        | { ok: false; error: string };
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
        <CardHeader
          title={t.admin.authorise}
          description={t.admin.authoriseLead}
        />

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
        <CardHeader
          title={t.admin.registered}
          description={t.admin.registeredLead}
        />

        <ul className="mt-5 divide-y divide-border-soft">
          {institutions.map((institution) => (
            <li
              key={institution.address}
              className="flex flex-wrap items-center gap-3 py-4"
            >
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
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { Ban, BadgeCheck, LogOut, TicketCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TechnicalDetails } from "@/components/ui/TechnicalDetails";
import { Scanner } from "@/features/scan/Scanner";
import { explorerTxUrl } from "@/lib/chain/client";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/features/i18n/LocaleProvider";
import { Icon, IconTile } from "@/components/ui/Icon";

/**
 * What a librarian or a science center operator actually uses.
 *
 * Two jobs, one screen: confirm that a visitor was here, and validate a ticket at the door.
 * Both outcomes -- success and refusal -- are shown large and unambiguously, because this is
 * read at arm's length across a desk while someone waits.
 */

export interface ConsoleActivity {
  slug: string;
  title: string;
  icon: string;
  cadence: "daily" | "once";
  xpReward: number;
}

interface CheckinResponse {
  ok: true;
  activity: { title: string; icon: string };
  credential: { title: string; icon: string };
  issuer: string;
  xpAwarded: number;
  txHash: string;
}

interface ConsumeResponse {
  ok: true;
  passId: string;
  holder: string;
  credential: { title: string; icon: string };
  activityTitle: string;
  xpAwarded: number;
  txHash: string;
}

type Outcome =
  | { kind: "success"; title: string; detail: string; icon: string; txHash: string }
  | { kind: "refused"; title: string; detail: string; code: string | null };

export function InstitutionConsole({
  institutionName,
  institutionIcon,
  activities,
  sellsTickets,
}: {
  institutionName: string;
  institutionIcon: string;
  activities: ConsoleActivity[];
  sellsTickets: boolean;
}) {
  const { t } = useTranslations();
  const [tab, setTab] = useState<"visitor" | "ticket">(sellsTickets ? "ticket" : "visitor");
  const [selected, setSelected] = useState(activities[0]?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [log, setLog] = useState<{ at: string; text: string; ok: boolean }[]>([]);

  const record = useCallback((text: string, ok: boolean) => {
    setLog((entries) =>
      [{ at: new Date().toLocaleTimeString("en-GB", { timeStyle: "short" }), text, ok }, ...entries].slice(
        0,
        8,
      ),
    );
  }, []);

  const verifyVisitor = useCallback(
    async (walletValue: string) => {
      setBusy(true);
      setOutcome(null);
      try {
        const response = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletValue, activitySlug: selected }),
        });
        const data = (await response.json()) as
          | CheckinResponse
          | { ok: false; error: string; code?: string | null };

        if (!data.ok) {
          setOutcome({
            kind: "refused",
            title: t.institution.notVerified,
            detail: data.error,
            code: data.code ?? null,
          });
          record(data.error, false);
          return;
        }

        setOutcome({
          kind: "success",
          title: t.institution.verified(data.activity.title),
          detail: t.institution.addedWithXp(data.credential.title, data.xpAwarded),
          icon: data.credential.icon,
          txHash: data.txHash,
        });
        record(`${data.activity.title} · +${data.xpAwarded} XP`, true);
      } catch {
        setOutcome({
          kind: "refused",
          title: t.institution.unreachable,
          detail: t.institution.tryAgainSoon,
          code: null,
        });
      } finally {
        setBusy(false);
      }
    },
    [selected, record, t],
  );

  const validateTicket = useCallback(
    async (passId: string) => {
      setBusy(true);
      setOutcome(null);
      try {
        const response = await fetch("/api/tickets/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passId }),
        });
        const data = (await response.json()) as
          | ConsumeResponse
          | { ok: false; error: string; code?: string | null };

        if (!data.ok) {
          setOutcome({
            kind: "refused",
            title: t.institution.ticketRefused,
            detail: data.error,
            code: data.code ?? null,
          });
          record(`Ticket #${passId} refused`, false);
          return;
        }

        setOutcome({
          kind: "success",
          title: t.institution.ticketAccepted(data.passId),
          detail: t.institution.addedWithXp(data.credential.title, data.xpAwarded),
          icon: data.credential.icon,
          txHash: data.txHash,
        });
        record(`Ticket #${data.passId} used`, true);
      } catch {
        setOutcome({
          kind: "refused",
          title: t.institution.unreachable,
          detail: t.institution.tryAgainSoon,
          code: null,
        });
      } finally {
        setBusy(false);
      }
    },
    [record, t],
  );

  async function signOut() {
    await fetch("/api/institution/session", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-paper-sunk text-2xl">
            <Icon name={institutionIcon} className="size-6" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
              {t.institution.console}
            </p>
            <h1 className="font-display text-xl font-bold text-ink">{institutionName}</h1>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
          <LogOut className="size-4" aria-hidden />
          {t.nav.signOut}
        </Button>
      </div>

      {/* Tabs */}
      {sellsTickets && activities.length > 0 ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("ticket")}
            className={cn(
              "flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors",
              tab === "ticket"
                ? "border-brand-500 bg-brand-100 text-brand-700"
                : "border-border-soft bg-paper-raised text-ink-soft",
            )}
          >
            {t.institution.tabTicket}
          </button>
          <button
            type="button"
            onClick={() => setTab("visitor")}
            className={cn(
              "flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors",
              tab === "visitor"
                ? "border-brand-500 bg-brand-100 text-brand-700"
                : "border-border-soft bg-paper-raised text-ink-soft",
            )}
          >
            {t.institution.tabVisitor}
          </button>
        </div>
      ) : null}

      <Card className="p-6">
        {tab === "visitor" ? (
          <>
            <CardHeader
              title={t.institution.confirmVisitor}
              description={t.institution.confirmVisitorLead}
            />

            {activities.length > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {activities.map((activity) => (
                  <button
                    key={activity.slug}
                    type="button"
                    onClick={() => setSelected(activity.slug)}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-sm font-medium",
                      selected === activity.slug
                        ? "border-brand-500 bg-brand-100 text-brand-700"
                        : "border-border-soft text-ink-soft hover:bg-paper-sunk",
                    )}
                  >
                    <Icon name={activity.icon} className="size-4" /> {activity.title}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-5">
              <Scanner
                expect="user"
                onResult={verifyVisitor}
                disabled={busy}
                paused={outcome !== null}
              />
            </div>
          </>
        ) : (
          <>
            <CardHeader
              title={t.institution.validateTicket}
              description={t.institution.validateTicketLead}
            />
            <div className="mt-5">
              <Scanner
                expect="ticket"
                onResult={validateTicket}
                disabled={busy}
                paused={outcome !== null}
                placeholder={t.institution.ticketNumberPlaceholder}
              />
            </div>
          </>
        )}

        {busy ? (
          <p className="mt-5 text-sm font-medium text-ink-soft">{t.institution.checkingRegistry}</p>
        ) : null}

      </Card>

      {/* The answer, as a card the operator has to dismiss.

          It used to sit inline below the scanner, which failed in the one situation that
          matters: at a desk, holding a phone, reading at arm's length, with the next person
          already waiting. It scrolled out of view on a laptop, and it left the camera running,
          so the same visitor was read again the moment the answer appeared. Now it takes the
          screen, says one thing, and clears on a tap. */}
      {outcome ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="scan-outcome-title"
          onClick={() => setOutcome(null)}
        >
          <div
            className={cn(
              "animate-pop w-full max-w-sm rounded-card p-7 text-center shadow-lift",
              outcome.kind === "success" ? "bg-emerald-100" : "bg-danger-100",
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {outcome.kind === "success" ? (
              <IconTile name={outcome.icon} tone="emerald" size="hero" className="mx-auto" />
            ) : (
              <span className="mx-auto grid size-20 place-items-center rounded-2xl bg-danger-100 text-danger-700 ring-1 ring-inset ring-danger-500/20">
                <Ban className="size-9" strokeWidth={1.75} aria-hidden />
              </span>
            )}

            <p
              id="scan-outcome-title"
              className="mt-4 flex items-center justify-center gap-2 font-display text-xl font-bold text-ink"
            >
              {outcome.kind === "success" ? (
                <BadgeCheck className="size-6 shrink-0 text-emerald-500" aria-hidden />
              ) : (
                <XCircle className="size-6 shrink-0 text-danger-500" aria-hidden />
              )}
              {outcome.title}
            </p>

            <p className="mt-2 text-sm text-ink-soft">{outcome.detail}</p>

            {outcome.kind === "refused" && outcome.code ? (
              <p className="mt-3 font-mono text-[0.7rem] text-ink-faint">
                {t.institution.refusedBy(outcome.code)}
              </p>
            ) : null}

            <Button className="mt-6 w-full" autoFocus onClick={() => setOutcome(null)}>
              {t.institution.nextVisitor}
            </Button>

            {outcome.kind === "success" ? (
              <TechnicalDetails
                className="mt-4"
                txHash={outcome.txHash}
                explorerUrl={explorerTxUrl(outcome.txHash)}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {log.length > 0 ? (
        <Card className="p-6">
          <CardHeader
            title={t.institution.recentVerifications}
            description={t.institution.recentVerificationsLead}
          />
          <ul className="mt-4 divide-y divide-border-soft">
            {log.map((entry, index) => (
              <li key={index} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="font-mono text-xs text-ink-faint">{entry.at}</span>
                <span className="flex-1 text-ink-soft">{entry.text}</span>
                <Badge tone={entry.ok ? "emerald" : "danger"}>
                  {entry.ok ? (
                    <TicketCheck className="size-3.5" aria-hidden />
                  ) : (
                    <XCircle className="size-3.5" aria-hidden />
                  )}
                  {entry.ok ? t.institution.accepted : t.institution.refused}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

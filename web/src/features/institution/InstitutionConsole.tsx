"use client";

import { useCallback, useState } from "react";
import { BadgeCheck, LogOut, TicketCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TechnicalDetails } from "@/components/ui/TechnicalDetails";
import { Scanner } from "@/features/scan/Scanner";
import { explorerTxUrl } from "@/lib/chain/client";
import { cn } from "@/lib/cn";

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
  emoji: string;
  cadence: "daily" | "once";
  xpReward: number;
}

interface CheckinResponse {
  ok: true;
  activity: { title: string; emoji: string };
  credential: { title: string; emoji: string };
  issuer: string;
  xpAwarded: number;
  txHash: string;
}

interface ConsumeResponse {
  ok: true;
  passId: string;
  holder: string;
  credential: { title: string; emoji: string };
  activityTitle: string;
  xpAwarded: number;
  txHash: string;
}

type Outcome =
  | { kind: "success"; title: string; detail: string; emoji: string; txHash: string }
  | { kind: "refused"; title: string; detail: string; code: string | null };

export function InstitutionConsole({
  institutionName,
  institutionEmoji,
  activities,
  sellsTickets,
}: {
  institutionName: string;
  institutionEmoji: string;
  activities: ConsoleActivity[];
  sellsTickets: boolean;
}) {
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
            title: "Not verified",
            detail: data.error,
            code: data.code ?? null,
          });
          record(data.error, false);
          return;
        }

        setOutcome({
          kind: "success",
          title: `${data.activity.title} verified`,
          detail: `${data.credential.title} added · +${data.xpAwarded} XP`,
          emoji: data.credential.emoji,
          txHash: data.txHash,
        });
        record(`${data.activity.title} · +${data.xpAwarded} XP`, true);
      } catch {
        setOutcome({
          kind: "refused",
          title: "Could not reach the city registry",
          detail: "Please try again in a moment.",
          code: null,
        });
      } finally {
        setBusy(false);
      }
    },
    [selected, record],
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
            title: "Ticket refused",
            detail: data.error,
            code: data.code ?? null,
          });
          record(`Ticket #${passId} refused`, false);
          return;
        }

        setOutcome({
          kind: "success",
          title: `Ticket #${data.passId} accepted`,
          detail: `${data.credential.title} added · +${data.xpAwarded} XP`,
          emoji: data.credential.emoji,
          txHash: data.txHash,
        });
        record(`Ticket #${data.passId} used`, true);
      } catch {
        setOutcome({
          kind: "refused",
          title: "Could not reach the city registry",
          detail: "Please try again in a moment.",
          code: null,
        });
      } finally {
        setBusy(false);
      }
    },
    [record],
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
            {institutionEmoji}
          </span>
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
              Staff console
            </p>
            <h1 className="font-display text-xl font-bold text-ink">{institutionName}</h1>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
          <LogOut className="size-4" aria-hidden />
          Sign out
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
            Validate a ticket
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
            Confirm a visitor
          </button>
        </div>
      ) : null}

      <Card className="p-6">
        {tab === "visitor" ? (
          <>
            <CardHeader
              title="Confirm a visitor"
              description="Scan the code on their phone to confirm they were here."
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
                    {activity.emoji} {activity.title}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-5">
              <Scanner expect="user" onResult={verifyVisitor} disabled={busy} />
            </div>
          </>
        ) : (
          <>
            <CardHeader
              title="Validate a ticket"
              description="Scan the ticket. It will be accepted once and only once."
            />
            <div className="mt-5">
              <Scanner
                expect="ticket"
                onResult={validateTicket}
                disabled={busy}
                placeholder="Ticket number"
              />
            </div>
          </>
        )}

        {busy ? (
          <p className="mt-5 text-sm font-medium text-ink-soft">Checking with the city registry…</p>
        ) : null}

        {outcome ? (
          <div
            className={cn(
              "animate-pop mt-5 rounded-2xl p-5",
              outcome.kind === "success" ? "bg-emerald-100" : "bg-danger-100",
            )}
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl" aria-hidden>
                {outcome.kind === "success" ? outcome.emoji : "🚫"}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                  {outcome.kind === "success" ? (
                    <BadgeCheck className="size-5 text-emerald-500" aria-hidden />
                  ) : (
                    <XCircle className="size-5 text-danger-500" aria-hidden />
                  )}
                  {outcome.title}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{outcome.detail}</p>

                {outcome.kind === "success" ? (
                  <TechnicalDetails
                    className="mt-3"
                    txHash={outcome.txHash}
                    explorerUrl={explorerTxUrl(outcome.txHash)}
                  />
                ) : outcome.code ? (
                  <p className="mt-3 font-mono text-[0.7rem] text-ink-faint">
                    refused by: {outcome.code}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {log.length > 0 ? (
        <Card className="p-6">
          <CardHeader
            title="Recent verifications"
            description="This session only. Visit histories are not kept."
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
                  {entry.ok ? "Accepted" : "Refused"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

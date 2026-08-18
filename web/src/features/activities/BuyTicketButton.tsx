"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAccount } from "@/features/auth/AccountProvider";

interface PurchaseResponse {
  ok: true;
  ticket: { passId: string; activityTitle: string; venue: string; priceTry: number };
  txHash: string;
}

/**
 * Buying a ticket.
 *
 * DEMO MOCK -- the card payment is simulated with a confirm step. In production this hands off
 * to an ordinary payment provider and the ticket is issued from that provider's webhook. Money
 * never touches the chain; the chain only holds the part that has to be spendable exactly once.
 */
export function BuyTicketButton({
  activitySlug,
  priceTry,
  title,
}: {
  activitySlug: string;
  priceTry: number;
  title: string;
}) {
  const router = useRouter();
  const { status, signIn } = useAccount();
  const [stage, setStage] = useState<"idle" | "checkout" | "paying" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [passId, setPassId] = useState<string | null>(null);

  if (status !== "signed-in") {
    return (
      <Button variant="secondary" onClick={() => signIn()}>
        Sign in to book
      </Button>
    );
  }

  async function pay() {
    setStage("paying");
    setError(null);
    try {
      const response = await fetch("/api/tickets/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activitySlug }),
      });
      const data = (await response.json()) as PurchaseResponse | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      setPassId(data.ticket.passId);
      setStage("done");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not be completed.");
      setStage("checkout");
    }
  }

  if (stage === "done") {
    return (
      <div className="rounded-2xl bg-emerald-100 p-4">
        <p className="flex items-center gap-2 font-semibold text-emerald-500">
          <Check className="size-4" aria-hidden />
          Ticket #{passId} is in your passport
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => router.push("/tickets")}
        >
          View ticket
        </Button>
      </div>
    );
  }

  if (stage === "idle") {
    return (
      <Button onClick={() => setStage("checkout")} className="gap-2">
        <CreditCard className="size-4" aria-hidden />
        Book for {priceTry} TL
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-border-soft bg-paper-sunk p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-sm text-ink-soft">Total</span>
        <span className="font-display text-xl font-bold text-ink">{priceTry} TL</span>
      </div>

      <p className="mt-3 rounded-xl bg-sun-100 px-3 py-2 text-xs text-sun-700">
        Demo checkout — no card is charged and no money moves.
      </p>

      {error ? <p className="mt-3 text-xs font-medium text-danger-700">{error}</p> : null}

      <div className="mt-4 flex gap-2">
        <Button onClick={pay} disabled={stage === "paying"} className="flex-1">
          {stage === "paying" ? "Processing…" : "Pay now"}
        </Button>
        <Button variant="ghost" onClick={() => setStage("idle")} disabled={stage === "paying"}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

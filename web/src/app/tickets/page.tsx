import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { QrCode } from "@/components/ui/QrCode";
import { TechnicalDetails } from "@/components/ui/TechnicalDetails";
import { SignInButton } from "@/features/auth/SignInButton";
import { currentWallet } from "@/server/session";
import { readPasses } from "@/lib/chain/reads";
import { resolveInstitutions } from "@/server/institutions";
import { ticketQrPayload } from "@/lib/qr";
import { explorerAddressUrl } from "@/lib/chain/client";

export const metadata = { title: "My Tickets — CityQuest" };

const STATUS_TONE = {
  Valid: "emerald",
  Used: "neutral",
  Cancelled: "danger",
  None: "neutral",
} as const;

const STATUS_LABEL = {
  Valid: "Valid",
  Used: "Used",
  Cancelled: "Cancelled",
  None: "Unknown",
} as const;

export default async function TicketsPage() {
  const wallet = await currentWallet();

  if (!wallet) {
    return (
      <div className="mx-auto grid w-full max-w-2xl place-items-center px-4 py-24 text-center sm:px-6">
        <span className="text-6xl">🎟️</span>
        <h1 className="mt-6 font-display text-3xl font-bold text-ink">Your tickets live here</h1>
        <p className="mt-3 text-ink-soft">Sign in to see anything you have booked.</p>
        <div className="mt-8 flex justify-center">
          <SignInButton redirectTo="/tickets" />
        </div>
      </div>
    );
  }

  const [passes, { byAddress }] = await Promise.all([readPasses(wallet), resolveInstitutions()]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          My tickets
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Show a ticket at the entrance and a member of staff will scan it. Each one works exactly
          once — a screenshot of a used ticket will not get anyone in.
        </p>
      </header>

      {passes.length === 0 ? (
        <Card className="mt-9 grid place-items-center p-12 text-center">
          <span className="text-5xl">🎟️</span>
          <p className="mt-4 font-display text-lg font-semibold text-ink">No tickets yet</p>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">
            Some experiences, like the earthquake simulation, need a ticket booked in advance.
          </p>
          <ButtonLink href="/activities" className="mt-6">
            Browse experiences
          </ButtonLink>
        </Card>
      ) : (
        <div className="mt-9 grid gap-5 sm:grid-cols-2">
          {passes.map((pass) => {
            const venue = byAddress.get(pass.institution.toLowerCase());
            const isValid = pass.status === "Valid";

            return (
              <Card
                key={pass.passId}
                className={`overflow-hidden ${isValid ? "" : "opacity-70"}`}
              >
                <div className="perforation h-2.5 w-full" />
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase">
                        Ticket #{pass.passId}
                      </p>
                      <h2 className="mt-1 font-display text-lg font-bold text-ink">
                        {pass.credential.title}
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        {venue?.emoji} {venue?.name ?? "Unknown venue"}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[pass.status]}>{STATUS_LABEL[pass.status]}</Badge>
                  </div>

                  {isValid ? (
                    <div className="mt-5 flex flex-col items-center">
                      <QrCode value={ticketQrPayload(pass.passId)} size={180} />
                      <p className="mt-3 text-center text-xs text-ink-faint">
                        Show this at the entrance
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 grid place-items-center rounded-2xl bg-paper-sunk py-10">
                      <span className="text-4xl grayscale" aria-hidden>
                        {pass.credential.emoji}
                      </span>
                      <p className="mt-3 text-sm font-semibold text-ink-soft">
                        {pass.status === "Used"
                          ? "Used — enjoy the memory"
                          : "This ticket was cancelled"}
                      </p>
                    </div>
                  )}

                  {pass.validUntil && isValid ? (
                    <p className="mt-4 text-center text-xs text-ink-faint">
                      Valid until{" "}
                      {pass.validUntil.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  ) : null}

                  <TechnicalDetails
                    className="mt-4"
                    rows={[
                      { label: "pass id", value: pass.passId },
                      { label: "venue", value: pass.institution },
                      { label: "status", value: pass.status },
                    ]}
                    explorerUrl={explorerAddressUrl(pass.institution)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {passes.some((pass) => pass.status === "Used") ? (
        <p className="mt-8 text-sm text-ink-soft">
          Used a ticket? The matching achievement is already in your{" "}
          <Link href="/passport" className="font-semibold text-brand-700 underline">
            passport
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

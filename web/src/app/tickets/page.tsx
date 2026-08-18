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
import { getTranslations } from "@/server/locale";
import { pick } from "@/lib/i18n/types";

export async function generateMetadata() {
  const { t } = await getTranslations();
  return { title: `${t.tickets.metaTitle} — CityQuest` };
}

const STATUS_TONE = {
  Valid: "emerald",
  Used: "neutral",
  Cancelled: "danger",
  None: "neutral",
} as const;

export default async function TicketsPage() {
  const [wallet, { locale, t }] = await Promise.all([currentWallet(), getTranslations()]);
  const statusLabel = {
    Valid: t.tickets.statusValid,
    Used: t.tickets.statusUsed,
    Cancelled: t.tickets.statusCancelled,
    None: t.tickets.statusUnknown,
  } as const;

  if (!wallet) {
    return (
      <div className="mx-auto grid w-full max-w-2xl place-items-center px-4 py-24 text-center sm:px-6">
        <span className="text-6xl">🎟️</span>
        <h1 className="mt-6 font-display text-3xl font-bold text-ink">{t.tickets.signedOutTitle}</h1>
        <p className="mt-3 text-ink-soft">{t.tickets.signedOutBody}</p>
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
          {t.tickets.title}
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          {t.tickets.lead}
        </p>
      </header>

      {passes.length === 0 ? (
        <Card className="mt-9 grid place-items-center p-12 text-center">
          <span className="text-5xl">🎟️</span>
          <p className="mt-4 font-display text-lg font-semibold text-ink">{t.tickets.none}</p>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">
            {t.tickets.noneBody}
          </p>
          <ButtonLink href="/activities" className="mt-6">
            {t.tickets.browse}
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
                        {t.tickets.ticketNumber(pass.passId)}
                      </p>
                      <h2 className="mt-1 font-display text-lg font-bold text-ink">
                        {pick(pass.credential.title, locale)}
                      </h2>
                      <p className="mt-1 text-sm text-ink-soft">
                        {venue?.emoji} {venue ? pick(venue.label, locale) : t.tickets.unknownVenue}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[pass.status]}>{statusLabel[pass.status]}</Badge>
                  </div>

                  {isValid ? (
                    <div className="mt-5 flex flex-col items-center">
                      <QrCode value={ticketQrPayload(pass.passId)} size={180} />
                      <p className="mt-3 text-center text-xs text-ink-faint">
                        {t.tickets.showAtEntrance}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 grid place-items-center rounded-2xl bg-paper-sunk py-10">
                      <span className="text-4xl grayscale" aria-hidden>
                        {pass.credential.emoji}
                      </span>
                      <p className="mt-3 text-sm font-semibold text-ink-soft">
                        {pass.status === "Used" ? t.tickets.usedBody : t.tickets.cancelledBody}
                      </p>
                    </div>
                  )}

                  {pass.validUntil && isValid ? (
                    <p className="mt-4 text-center text-xs text-ink-faint">
                      {t.tickets.validUntil(
                        pass.validUntil.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }),
                      )}
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
          {t.tickets.usedHint}{" "}
          <Link href="/passport" className="font-semibold text-brand-700 underline">
            {t.tickets.passportWord}
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

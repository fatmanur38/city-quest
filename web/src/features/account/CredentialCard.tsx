import { ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { VerifiedMark } from "@/components/ui/VerifiedMark";
import { TechnicalDetails } from "@/components/ui/TechnicalDetails";
import type { CredentialView } from "@/server/account-service";
import { pick, type Locale } from "@/lib/i18n/types";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { explorerAddressUrl } from "@/lib/chain/client";

function monthYear(date: Date, locale: Locale): string {
  return date.toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One achievement. The issuer is given as much visual weight as the achievement itself, because
 * "who says so" is the entire value of the record.
 */
export function CredentialCard({
  credential,
  locale,
  t,
}: {
  credential: CredentialView;
  locale: Locale;
  t: Dictionary;
}) {
  const { definition, issuerName, issuerEmoji, revoked, issuedAt } = credential;

  return (
    <Card className={`animate-pop p-5 ${revoked ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-paper-sunk text-3xl">
          {definition.emoji}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold text-ink">
              {pick(definition.title, locale)}
            </h3>
            {definition.tier === "milestone" ? (
              <span className="rounded-full bg-sun-100 px-2 py-0.5 text-[0.7rem] font-bold text-sun-700">
                {t.account.milestone}
              </span>
            ) : null}
          </div>

          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {pick(definition.description, locale)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {revoked ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-100 px-2.5 py-1 text-xs font-semibold text-danger-700">
                <ShieldOff className="size-3.5" aria-hidden />
                {t.account.withdrawnBy(pick(issuerName, locale))}
              </span>
            ) : (
              <VerifiedMark issuer={`${issuerEmoji} ${pick(issuerName, locale)}`} label={t.common.verifiedBy} />
            )}
            <span className="text-xs text-ink-faint">{t.account.earnedOn(monthYear(issuedAt, locale))}</span>
          </div>

          <TechnicalDetails
            label={t.common.technicalDetails}
            className="mt-3"
            rows={[
              { label: "type", value: definition.name },
              { label: "hash", value: credential.hash },
              { label: "issuer", value: credential.issuer },
            ]}
            explorerUrl={explorerAddressUrl(credential.issuer)}
          />
        </div>
      </div>
    </Card>
  );
}

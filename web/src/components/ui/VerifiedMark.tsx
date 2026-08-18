import { BadgeCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The single most important distinction in this product's interface: whether an institution
 * vouched for something, or whether the app awarded it by itself.
 *
 * A quiz score is real, but nobody watched you take it. A library visit was confirmed by a
 * librarian and signed by the library. Showing those two things identically would quietly
 * undermine the entire argument for building this on a shared registry, so they never look
 * the same anywhere in the app.
 */

export function VerifiedMark({
  issuer,
  label,
  fallback = "Verified institution",
  className,
}: {
  issuer?: string;
  /** Formats "Verified by X" in the reader's language. */
  label?: (issuer: string) => string;
  fallback?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700",
        className,
      )}
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      {issuer ? (label ? label(issuer) : `Verified by ${issuer}`) : fallback}
    </span>
  );
}

export function AppAwardedMark({
  label = "City app points",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-paper-sunk px-2.5 py-1 text-xs font-semibold text-ink-faint",
        className,
      )}
    >
      <Sparkles className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

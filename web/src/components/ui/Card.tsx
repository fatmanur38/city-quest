import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The surface everything in the app sits on.
 *
 * `interactive` is here rather than sprinkled at call sites because a card that responds to the
 * pointer is making a promise -- that something happens if you click it -- and that promise
 * should be made in one place, consistently.
 */
export function Card({
  className,
  interactive,
  ...props
}: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-card border border-border-soft bg-paper-raised shadow-soft",
        interactive &&
          "transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="card-header" className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** An eyebrow above a section heading. Small, spaced, and never the loudest thing on screen. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-xs font-semibold tracking-[0.14em] text-ink-faint uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

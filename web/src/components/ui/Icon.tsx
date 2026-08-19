import { cva, type VariantProps } from "class-variance-authority";
import { iconFor } from "@/lib/icons";
import { cn } from "@/lib/cn";

/**
 * How an achievement, a place or an activity shows its face.
 *
 * A tile rather than a bare glyph, because these appear in lists where the eye needs an anchor
 * of consistent size and weight -- an icon alone floats. The tone is the subject's own accent,
 * so a page of activities reads as a set of distinct things rather than a wall of teal.
 */

const tile = cva(
  "grid shrink-0 place-items-center rounded-2xl ring-1 ring-inset transition-colors",
  {
    variants: {
      tone: {
        brand: "bg-brand-100 text-brand-700 ring-brand-500/15",
        sun: "bg-sun-100 text-sun-700 ring-sun-500/20",
        sky: "bg-sky-100 text-sky-500 ring-sky-500/20",
        violet: "bg-violet-100 text-violet-500 ring-violet-500/20",
        emerald: "bg-emerald-100 text-emerald-500 ring-emerald-500/20",
        berry: "bg-berry-100 text-berry-500 ring-berry-500/20",
        danger: "bg-danger-100 text-danger-700 ring-danger-500/20",
        neutral: "bg-paper-sunk text-ink-soft ring-border-soft",
        /** For the dark teal band, where a tinted tile would disappear. */
        onBand: "bg-band-chip text-on-band ring-white/10",
      },
      size: {
        sm: "size-9 [&_svg]:size-4",
        md: "size-11 [&_svg]:size-5",
        lg: "size-14 [&_svg]:size-6",
        xl: "size-16 [&_svg]:size-7",
        hero: "size-20 [&_svg]:size-9",
      },
    },
    defaultVariants: { tone: "brand", size: "md" },
  },
);

export type IconTone = NonNullable<VariantProps<typeof tile>["tone"]>;

/** The catalogue's accent names, which predate this component, mapped onto tones. */
export const ACCENT_TONE: Record<string, IconTone> = {
  sky: "sky",
  amber: "sun",
  violet: "violet",
  emerald: "emerald",
};

export function IconTile({
  name,
  tone,
  size,
  className,
  label,
}: {
  name: string | null | undefined;
  className?: string;
  /** Screen-reader text. Omit when a visible label sits right beside it. */
  label?: string;
} & VariantProps<typeof tile>) {
  const Glyph = iconFor(name);
  return (
    <span className={cn(tile({ tone, size }), className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <Glyph strokeWidth={1.75} />
    </span>
  );
}

/** The glyph on its own, for use inside text, buttons and table cells. */
export function Icon({
  name,
  className,
  label,
}: {
  name: string | null | undefined;
  className?: string;
  label?: string;
}) {
  const Glyph = iconFor(name);
  return (
    <Glyph
      className={cn("size-5 shrink-0", className)}
      strokeWidth={1.75}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

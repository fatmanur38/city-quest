import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Tones name a *meaning*, not a colour: emerald is "this went through", danger is "this was
 * refused", sun is "you earned something". Call sites pick the meaning and the palette decides
 * how it looks, which is what keeps both themes coherent.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        brand: "bg-brand-100 text-brand-700",
        sun: "bg-sun-100 text-sun-700",
        sky: "bg-sky-100 text-sky-500",
        violet: "bg-violet-100 text-violet-500",
        emerald: "bg-emerald-100 text-emerald-500",
        neutral: "bg-paper-sunk text-ink-soft",
        danger: "bg-danger-100 text-danger-700",
        outline: "border border-border-soft text-ink-soft",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  tone,
  className,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
  );
}

export { badgeVariants };

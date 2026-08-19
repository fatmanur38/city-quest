import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Built on shadcn's structure -- cva variants, `data-slot`, `asChild` -- but wearing this
 * project's identity rather than the default one. The pill shape and the civic teal are the
 * point; a generic shadcn button would make this look like every other hackathon entry.
 */

const buttonVariants = cva(
  // whitespace-nowrap: the fixed heights below assume one line, so a label that wraps -- which
  // Turkish labels do first, being longer -- breaks out of the button rather than growing it.
  [
    "inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap",
    "transition-all duration-150 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[1.15em]",
    "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    "disabled:cursor-not-allowed disabled:opacity-60",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-brand-600 text-on-brand shadow-soft hover:bg-brand-hover hover:shadow-lift active:bg-brand-active active:shadow-soft disabled:bg-brand-300 disabled:shadow-none",
        secondary:
          "border border-border-soft bg-paper-raised text-ink hover:border-brand-300 hover:bg-paper-sunk active:bg-paper-sunk",
        outline:
          "border border-border-soft bg-transparent text-ink hover:border-brand-300 hover:bg-paper-sunk",
        ghost: "text-ink-soft hover:bg-paper-sunk hover:text-ink",
        danger: "bg-danger-500 text-on-brand shadow-soft hover:bg-danger-700",
      },
      size: {
        sm: "h-9 gap-1.5 px-3.5 text-sm",
        md: "h-11 gap-2 px-5 text-[0.95rem]",
        lg: "h-14 gap-2.5 px-7 text-lg",
        icon: "size-11 gap-0 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonStyle = VariantProps<typeof buttonVariants>;

export function Button({
  variant,
  size,
  className,
  asChild,
  ...props
}: ComponentProps<"button"> & ButtonStyle & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

/** The same surface as a link, so navigation never has to be faked with an onClick. */
export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return (
    <Link
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };

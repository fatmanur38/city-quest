import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-on-brand hover:bg-brand-hover active:bg-brand-active shadow-soft disabled:bg-brand-300",
  secondary:
    "bg-paper-raised text-ink border border-border-soft hover:bg-paper-sunk active:bg-paper-sunk",
  ghost: "text-ink-soft hover:bg-paper-sunk hover:text-ink",
  danger: "bg-danger-500 text-on-brand hover:bg-danger-700",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[0.95rem] gap-2",
  lg: "h-14 px-7 text-lg gap-2.5",
};

const BASE =
  // whitespace-nowrap: the fixed heights above assume one line, so a label that wraps -- which
  // Turkish labels do first, being longer -- breaks out of the button rather than growing it.
  "inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 " +
  "disabled:cursor-not-allowed disabled:opacity-70";

interface StyleProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: StyleProps & ComponentProps<"button">) {
  return (
    <button className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: StyleProps & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </Link>
  );
}

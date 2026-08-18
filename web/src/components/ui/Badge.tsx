import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "brand" | "sun" | "sky" | "violet" | "emerald" | "neutral" | "danger";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-100 text-brand-700",
  sun: "bg-sun-100 text-sun-700",
  sky: "bg-sky-100 text-sky-500",
  violet: "bg-violet-100 text-violet-500",
  emerald: "bg-emerald-100 text-emerald-500",
  neutral: "bg-paper-sunk text-ink-soft",
  danger: "bg-danger-100 text-danger-700",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

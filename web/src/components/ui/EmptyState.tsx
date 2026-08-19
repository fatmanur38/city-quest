import type { ReactNode } from "react";
import { IconTile, type IconTone } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/**
 * What a screen says when there is nothing on it yet.
 *
 * These were six separate blocks with the same shape and a different emoji each. Collecting
 * them means the empty case gets the same care as the full one -- an icon that belongs to the
 * palette, a heading, a sentence that explains what would put something here, and, crucially,
 * a way to go and do it. An empty screen without an exit is a dead end.
 */
export function EmptyState({
  icon,
  tone = "neutral",
  title,
  body,
  action,
  className,
}: {
  icon: string;
  tone?: IconTone;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid place-items-center px-6 py-14 text-center", className)}>
      <IconTile name={icon} tone={tone} size="hero" />
      <p className="mt-5 font-display text-lg font-bold text-ink text-balance">{title}</p>
      {body ? <p className="mt-2 max-w-sm text-sm text-ink-soft text-pretty">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

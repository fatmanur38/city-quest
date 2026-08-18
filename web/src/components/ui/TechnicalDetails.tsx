"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Where the blockchain is allowed to be visible.
 *
 * Nothing in the citizen-facing interface says "transaction", "mint" or "NFT". Someone who
 * wants to check the underlying record -- a curious student, a sceptical teacher, a judge at a
 * hackathon -- can open this and follow it all the way to the chain.
 */
export function TechnicalDetails({
  txHash,
  explorerUrl,
  rows,
  className,
}: {
  txHash?: string | null;
  explorerUrl?: string | null;
  rows?: { label: string; value: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!txHash && !rows?.length) return null;

  return (
    <div className={cn("text-xs", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 font-medium text-ink-faint hover:text-ink-soft"
        aria-expanded={open}
      >
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        Technical details
      </button>

      {open ? (
        <dl className="mt-2 space-y-1.5 rounded-xl bg-paper-sunk p-3 font-mono text-[0.7rem] text-ink-soft">
          {rows?.map((row) => (
            <div key={row.label} className="flex flex-wrap gap-x-2">
              <dt className="text-ink-faint">{row.label}</dt>
              <dd className="break-all">{row.value}</dd>
            </div>
          ))}
          {txHash ? (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-ink-faint">transaction</dt>
              <dd className="break-all">
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-brand-700 underline"
                  >
                    {txHash}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : (
                  txHash
                )}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

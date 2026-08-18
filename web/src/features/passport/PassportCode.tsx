"use client";

import { useState } from "react";
import { QrCode as QrIcon } from "lucide-react";
import { QrCode } from "@/components/ui/QrCode";
import { Button } from "@/components/ui/Button";
import { userQrPayload } from "@/lib/qr";

/**
 * The code a citizen shows at the desk.
 *
 * It is just their passport address. That is safe to show: an address alone cannot claim
 * anything, because only an authorised institution's signature can create an achievement.
 */
export function PassportCode({ wallet }: { wallet: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="gap-2">
        <QrIcon className="size-4" aria-hidden />
        Show my code
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-pop w-full max-w-sm rounded-card bg-paper-raised p-7 text-center shadow-lift"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold text-ink">Show this at the desk</h2>
            <p className="mt-2 text-sm text-ink-soft">
              A member of staff scans it to confirm you were here.
            </p>

            <div className="mt-6 flex justify-center">
              <QrCode value={userQrPayload(wallet)} size={240} />
            </div>

            <p className="mt-5 font-mono text-[0.7rem] break-all text-ink-faint">{wallet}</p>

            <Button className="mt-6 w-full" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

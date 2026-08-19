"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { parseQrPayload } from "@/lib/qr";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/features/i18n/LocaleProvider";

/**
 * Scanning at the desk.
 *
 * Camera access is genuinely useful and genuinely unreliable -- it needs HTTPS, a permission
 * prompt, and a device that has a camera at all. So typing the code by hand is a first-class
 * path here, not a hidden fallback: a demo must never fail because a browser refused a camera.
 */
/** How long a code that was just answered for stays ignored after the camera comes back. */
const REPEAT_GRACE_MS = 5000;

export function Scanner({
  expect,
  onResult,
  disabled,
  paused,
  placeholder,
}: {
  expect: "user" | "ticket";
  onResult: (value: string) => void;
  disabled?: boolean;
  /**
   * Holds the camera off while the answer to the last scan is still on screen. Without it the
   * same visitor is read again and again -- the desk would send a second request before the
   * first had even reached the chain, and the operator would watch a success turn into "already
   * verified today" a second later.
   */
  paused?: boolean;
  placeholder?: string;
}) {
  const { t } = useTranslations();
  const [mode, setMode] = useState<"manual" | "camera">("manual");
  const [typed, setTyped] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /**
   * The code that was just answered for, and when.
   *
   * Without this, dismissing a result while the same phone is still in front of the lens reads
   * it again immediately -- so the operator taps "next visitor" and is handed "already verified
   * today" for the person who just walked up. A different code is never delayed; only the one
   * already dealt with is, and only for as long as it takes to lower a phone.
   */
  const lastHandled = useRef<{ value: string; at: number } | null>(null);

  const cameraFailedMessage = t.institution.cameraFailed;

  useEffect(() => {
    if (mode !== "camera" || paused || disabled) return;

    if (lastHandled.current) lastHandled.current = { ...lastHandled.current, at: Date.now() };

    let scanner: { stop: () => void; destroy: () => void } | null = null;
    let cancelled = false;
    // Guards the gap between reading a code and React re-rendering with `paused` true. State
    // updates are not synchronous, so without this the next few frames get through.
    let handled = false;

    void (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled || !videoRef.current) return;

        const instance = new QrScanner(
          videoRef.current,
          (result: { data: string }) => {
            if (handled) return;
            const parsed = parseQrPayload(result.data);
            if (!parsed || parsed.kind !== expect) return;

            const value = parsed.kind === "user" ? parsed.wallet : parsed.passId;
            const previous = lastHandled.current;
            if (previous && previous.value === value && Date.now() - previous.at < REPEAT_GRACE_MS) {
              return;
            }

            // One scan, one answer. The camera stops here rather than after the round trip,
            // because the round trip takes seconds and the code stays in frame the whole time.
            handled = true;
            lastHandled.current = { value, at: Date.now() };
            instance.stop();
            onResult(value);
          },
          { highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 4 },
        );
        scanner = instance;
        await instance.start();
      } catch {
        if (!cancelled) {
          setCameraError(cameraFailedMessage);
          setMode("manual");
        }
      }
    })();

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [mode, expect, onResult, disabled, paused, cameraFailedMessage]);

  function submitTyped() {
    const parsed = parseQrPayload(typed);
    if (!parsed || parsed.kind !== expect) {
      setCameraError(
        expect === "user" ? t.institution.notAnAccountCode : t.institution.notATicketNumber,
      );
      return;
    }
    setCameraError(null);
    onResult(parsed.kind === "user" ? parsed.wallet : parsed.passId);
    setTyped("");
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
            mode === "manual" ? "bg-brand-100 text-brand-700" : "text-ink-soft hover:bg-paper-sunk",
          )}
        >
          <Keyboard className="size-4" aria-hidden />
          {t.institution.typeCode}
        </button>
        <button
          type="button"
          onClick={() => {
            setCameraError(null);
            setMode("camera");
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
            mode === "camera" ? "bg-brand-100 text-brand-700" : "text-ink-soft hover:bg-paper-sunk",
          )}
        >
          <Camera className="size-4" aria-hidden />
          {t.institution.useCamera}
        </button>
      </div>

      {mode === "camera" ? (
        <div className="relative overflow-hidden rounded-2xl bg-ink">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          <p className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-center text-xs text-white">
            {paused || disabled ? t.institution.cameraPaused : t.institution.cameraHint}
          </p>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitTyped();
            }}
            placeholder={placeholder ?? t.institution.accountOrTicket}
            disabled={disabled}
            className="h-11 min-w-0 flex-1 rounded-full border border-border-soft bg-paper-raised px-4 text-sm focus:border-brand-500 focus:outline-none"
          />
          <Button onClick={submitTyped} disabled={disabled || typed.trim().length === 0}>
            {t.common.check}
          </Button>
        </div>
      )}

      {cameraError ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-danger-700">
          <CameraOff className="size-3.5" aria-hidden />
          {cameraError}
        </p>
      ) : null}
    </div>
  );
}

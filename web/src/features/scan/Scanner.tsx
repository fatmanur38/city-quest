"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { parseQrPayload } from "@/lib/qr";
import { cn } from "@/lib/cn";

/**
 * Scanning at the desk.
 *
 * Camera access is genuinely useful and genuinely unreliable -- it needs HTTPS, a permission
 * prompt, and a device that has a camera at all. So typing the code by hand is a first-class
 * path here, not a hidden fallback: a demo must never fail because a browser refused a camera.
 */
export function Scanner({
  expect,
  onResult,
  disabled,
  placeholder = "Passport code or ticket number",
}: {
  expect: "user" | "ticket";
  onResult: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [mode, setMode] = useState<"manual" | "camera">("manual");
  const [typed, setTyped] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (mode !== "camera") return;

    let scanner: { stop: () => void; destroy: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled || !videoRef.current) return;

        const instance = new QrScanner(
          videoRef.current,
          (result: { data: string }) => {
            const parsed = parseQrPayload(result.data);
            if (!parsed || parsed.kind !== expect) return;
            onResult(parsed.kind === "user" ? parsed.wallet : parsed.passId);
          },
          { highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 4 },
        );
        scanner = instance;
        await instance.start();
      } catch {
        if (!cancelled) {
          setCameraError("The camera could not be opened. Type the code instead.");
          setMode("manual");
        }
      }
    })();

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [mode, expect, onResult]);

  function submitTyped() {
    const parsed = parseQrPayload(typed);
    if (!parsed || parsed.kind !== expect) {
      setCameraError(
        expect === "user"
          ? "That does not look like a passport code."
          : "That does not look like a ticket number.",
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
          Type code
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
          Use camera
        </button>
      </div>

      {mode === "camera" ? (
        <div className="relative overflow-hidden rounded-2xl bg-ink">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          <p className="absolute inset-x-0 bottom-0 bg-ink/70 p-2 text-center text-xs text-white">
            Point at the code on the visitor&apos;s phone
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
            placeholder={placeholder}
            disabled={disabled}
            className="h-11 min-w-0 flex-1 rounded-full border border-border-soft bg-paper-raised px-4 text-sm focus:border-brand-500 focus:outline-none"
          />
          <Button onClick={submitTyped} disabled={disabled || typed.trim().length === 0}>
            Check
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

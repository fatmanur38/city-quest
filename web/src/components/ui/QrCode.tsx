"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/cn";

/**
 * Renders a QR code as an SVG data URL.
 *
 * The QR itself is only a pointer -- a passport address or a ticket number. Holding it proves
 * nothing: every screen that scans one re-checks ownership, authority and usage state against
 * the contract before anything happens.
 */
export function QrCode({
  value,
  size = 220,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: size * 2,
      color: { dark: "#1c1917", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return (
    <div
      className={cn(
        "grid place-items-center overflow-hidden rounded-2xl bg-white p-3 shadow-soft",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="Passport code" width={size - 24} height={size - 24} />
      ) : (
        <div className="size-full animate-pulse rounded-xl bg-paper-sunk" />
      )}
    </div>
  );
}

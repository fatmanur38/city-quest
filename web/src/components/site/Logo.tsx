import { cn } from "@/lib/cn";

/**
 * The CityQuest mark, drawn rather than imported.
 *
 * A map pin whose ring opens into a C, holding a skyline, a path climbing out of the city and a
 * flag on the tallest building -- exploration and civic learning in one shape.
 *
 * Vector for three reasons: it stays sharp on a projector, it costs about three kilobytes, and
 * its colours are the app's own tokens, so it re-themes with everything else rather than sitting
 * on a white rectangle in dark mode. The body is one filled teardrop with the centre knocked out
 * by `evenodd` and the opening cut by a mask -- a stroked arc left a thin tail that read as a
 * tick mark rather than a pin point.
 */

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-hidden
      className={cn("size-9", className)}
    >
      <defs>
        <linearGradient
          id="cq-ring"
          x1="46"
          y1="6"
          x2="24"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--color-sky-500)" />
          <stop offset=".55" stopColor="var(--color-brand-500)" />
          <stop offset="1" stopColor="var(--color-brand-600)" />
        </linearGradient>
        <clipPath id="cq-inside">
          <circle cx="32" cy="26" r="15.5" />
        </clipPath>
        <mask id="cq-gap">
          <rect width="64" height="64" fill="#fff" />
          <path d="M32 26 66 34 66 -2 46 -2Z" fill="#000" />
        </mask>
      </defs>

      <g clipPath="url(#cq-inside)">
        <circle cx="32" cy="26" r="15.5" fill="var(--color-brand-50)" />

        <rect
          x="18.5"
          y="26"
          width="5"
          height="12"
          rx="1"
          fill="var(--color-sky-500)"
          opacity=".5"
        />
        <rect
          x="25"
          y="17"
          width="6.5"
          height="21"
          rx="1"
          fill="var(--color-sky-500)"
        />
        <rect
          x="33"
          y="22"
          width="5.5"
          height="16"
          rx="1"
          fill="var(--color-brand-600)"
          opacity=".85"
        />
        <rect
          x="40"
          y="27.5"
          width="4.5"
          height="11"
          rx="1"
          fill="var(--color-sky-500)"
          opacity=".4"
        />

        <path
          d="M28.2 17.5V9.5"
          stroke="var(--color-brand-700)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path d="M28.2 10L34.4 12.1L28.2 14.2Z" fill="var(--color-sun-500)" />

        <path
          d="M9 34c6.5-3 11.5.6 16.5-.5s9.5-3 13-2.5 6 1.8 9.5.7V44H9Z"
          fill="var(--color-brand-600)"
        />
        <path
          d="M32.6 28.5c-.6 3.4-4.2 4-3.6 7.2.6 3.2 3.8 3.8 2.8 7.3"
          stroke="var(--color-brand-50)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      <path
        fillRule="evenodd"
        clipRule="evenodd"
        mask="url(#cq-gap)"
        fill="url(#cq-ring)"
        d="M16 41.1A22 22 0 1 1 48 41.1L32 58ZM32 10.5a15.5 15.5 0 1 0 0 31 15.5 15.5 0 0 0 0-31Z"
      />

      <path
        d="M47.8 11.6 49.5 15.7 53.6 17.4 49.5 19.1 47.8 23.2 46.1 19.1 42 17.4 46.1 15.7Z"
        fill="var(--color-sun-500)"
      />
    </svg>
  );
}

/** Mark plus wordmark, with the tagline only where there is room for it. */
export function Logo({
  className,
  withTagline = false,
}: {
  className?: string;
  withTagline?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="size-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-extrabold tracking-tight text-ink">
          City<span className="text-brand-700">Quest</span>
        </span>
        {withTagline ? (
          <span className="mt-1 text-[0.6rem] font-semibold tracking-[0.14em] text-ink-faint uppercase">
            Learn. Explore. Shape your city.
          </span>
        ) : null}
      </span>
    </span>
  );
}

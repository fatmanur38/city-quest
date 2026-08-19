"use client";

import { OFFER_ICONS, iconFor, type IconName } from "@/lib/icons";
import { cn } from "@/lib/cn";

/**
 * Choosing the face of a campaign, or of a business.
 *
 * This replaced a text field that a person was expected to paste an emoji into -- which meant
 * the field accepted anything at all, including nothing, and the result rendered differently on
 * every operating system. A closed set removes the failure entirely: whatever is picked is
 * guaranteed to exist, to match the palette, and to look the same at the desk as on the phone.
 */
export function IconPicker({
  value,
  onChange,
  label,
  icons = OFFER_ICONS,
}: {
  value: string;
  onChange: (name: IconName) => void;
  label: string;
  icons?: IconName[];
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {icons.map((name) => {
          const Glyph = iconFor(name);
          const selected = value === name;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              onClick={() => onChange(name)}
              className={cn(
                "grid size-10 place-items-center rounded-xl border transition-colors",
                "focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                selected
                  ? "border-brand-500 bg-brand-100 text-brand-700"
                  : "border-border-soft text-ink-faint hover:border-brand-300 hover:bg-paper-sunk hover:text-ink-soft",
              )}
            >
              <Glyph className="size-5" strokeWidth={1.75} />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

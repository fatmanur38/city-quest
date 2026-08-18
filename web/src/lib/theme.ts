/**
 * Light and dark, with "system" as a real third state rather than an implicit default.
 *
 * Storing the choice in a cookie rather than localStorage is what lets the server put the right
 * `data-theme` on <html> in the first response. A localStorage theme cannot be read until
 * JavaScript runs, which is why so many sites flash white before going dark.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "system";
export const THEME_COOKIE = "cq_theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

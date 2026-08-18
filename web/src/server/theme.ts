import { cookies } from "next/headers";
import { DEFAULT_THEME, THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";

/**
 * The chosen theme, read on the server so <html> carries it on the first paint.
 *
 * "system" deliberately renders no attribute at all: the CSS then falls through to
 * `prefers-color-scheme`, which is the only thing that knows the reader's real preference.
 */
export async function currentTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
}

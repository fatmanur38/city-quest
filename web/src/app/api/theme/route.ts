import { cookies } from "next/headers";
import { z } from "zod";
import { handle, ok, parseBody } from "@/server/api";
import { THEMES, THEME_COOKIE } from "@/lib/theme";

const schema = z.object({ theme: z.enum(THEMES) });

/** Remembers light or dark for a year. A display preference, not personal data. */
export async function POST(request: Request) {
  return handle(async () => {
    const { theme } = await parseBody(request, schema);
    (await cookies()).set(THEME_COOKIE, theme, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return ok({ theme });
  });
}

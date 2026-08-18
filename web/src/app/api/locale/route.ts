import { cookies } from "next/headers";
import { z } from "zod";
import { handle, ok, parseBody } from "@/server/api";
import { LOCALES, LOCALE_COOKIE } from "@/lib/i18n/types";

const schema = z.object({ locale: z.enum(LOCALES) });

/** Remembers the reader's language for a year. Not personal data, so no consent theatre. */
export async function POST(request: Request) {
  return handle(async () => {
    const { locale } = await parseBody(request, schema);
    (await cookies()).set(LOCALE_COOKIE, locale, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return ok({ locale });
  });
}

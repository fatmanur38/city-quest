import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { SessionError } from "./session";
import { toFriendlyError } from "./chain/errors";
import { MissingRelayerError, MissingSignerError } from "./chain/signer";
import { getTranslations } from "./locale";

/** Uniform JSON responses, so the client never has to guess at a shape. */

export interface ApiFailure {
  ok: false;
  error: string;
  /** Contract error name or validation code, for the Technical Details panel. */
  code?: string | null;
}

export function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json({ ok: true as const, ...data }, { status });
}

export function fail(error: string, status = 400, code: string | null = null) {
  return NextResponse.json<ApiFailure>({ ok: false, error, code }, { status });
}

/** Parses a JSON body against a schema, reporting the first problem in plain language. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new BadRequestError("That request could not be read.");
  }
  try {
    return schema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      // A whole-object refinement has no path, so prefixing one would read ": nothing to change".
      const where = issue?.path.join(".");
      throw new BadRequestError(
        issue ? (where ? `${where}: ${issue.message}` : issue.message) : "Invalid request.",
      );
    }
    throw error;
  }
}

export class BadRequestError extends Error {}

/**
 * One place where every route's failure modes turn into a response. Keeps the handlers
 * themselves free of try/catch noise.
 */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof BadRequestError) return fail(error.message, 400);

    // Everything below is shown to a person, so it has to be said in their language. Reading the
    // locale here rather than in every route keeps the handlers free of it.
    const { t } = await getTranslations();

    if (error instanceof SessionError) return fail(t.errors[error.key], 401);
    if (error instanceof MissingSignerError || error instanceof MissingRelayerError) {
      console.error("[api] configuration error", error);
      return fail(error.message, 503, "NotConfigured");
    }
    const friendly = toFriendlyError(error, t);
    console.error("[api]", friendly.code ?? "error", error);
    return fail(friendly.message, friendly.code ? 409 : 500, friendly.code);
  }
}

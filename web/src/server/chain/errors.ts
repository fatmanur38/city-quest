import { BaseError, ContractFunctionRevertedError } from "viem";
import type { Dictionary } from "@/lib/i18n/dictionary";

/**
 * Turns a contract revert into something a fourteen-year-old can act on, in their own language.
 *
 * The technical name is kept alongside the friendly text so the Technical Details panel can show
 * exactly which on-chain rule fired, without putting "ActivityAlreadyVerified" in front of a
 * citizen. The wording itself lives in the dictionary, because a refusal at the desk is read by
 * the same person as everything else on the screen.
 */

type ChainErrors = Dictionary["errors"]["chain"];

export interface FriendlyError {
  message: string;
  /** Contract error name, when the failure came from a revert. */
  code: string | null;
}

export function revertName(error: unknown): string | null {
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      return revert.data?.errorName ?? revert.reason ?? null;
    }
  }
  return null;
}

function known(errors: ChainErrors, code: string): string | null {
  return code in errors ? errors[code as keyof ChainErrors] : null;
}

export function toFriendlyError(error: unknown, t: Dictionary): FriendlyError {
  const errors = t.errors.chain;
  const fallback = t.errors.somethingWentWrong;

  const code = revertName(error);
  if (code) {
    const message = known(errors, code);
    return { message: message ?? fallback, code };
  }

  const message = error instanceof Error ? error.message : "";
  if (/insufficient funds/i.test(message)) {
    return { message: errors.InsufficientFunds, code: "InsufficientFunds" };
  }
  if (/fetch failed|ECONNREFUSED|network/i.test(message)) {
    return { message: errors.NetworkUnavailable, code: "NetworkUnavailable" };
  }
  return { message: fallback, code: null };
}

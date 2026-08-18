import { BaseError, ContractFunctionRevertedError } from "viem";

/**
 * Turns a contract revert into something a fourteen-year-old can act on.
 *
 * The technical name is kept alongside the friendly text so the Technical Details panel can show
 * exactly which on-chain rule fired, without putting "ActivityAlreadyVerified" in front of a
 * citizen.
 */

const FRIENDLY: Record<string, string> = {
  ActivityAlreadyVerified: "You have already been verified for this today.",
  UnauthorizedInstitution:
    "This institution is not authorised to issue achievements right now. Please ask the desk to contact the municipality.",
  InvalidSignature: "That verification could not be confirmed. Please ask the desk to try again.",
  ClaimExpired: "That verification took too long and expired. Please try again.",
  PassNotValid: "This ticket has already been used.",
  PassExpired: "This ticket has expired.",
  PassNotFound: "We could not find that ticket.",
  NotIssuingInstitution: "This ticket belongs to a different venue.",
  SoulboundTransferNotAllowed: "Achievements stay with the person who earned them.",
  InstitutionAlreadyRegistered: "That institution is already registered.",
  InstitutionNotRegistered: "That institution is not registered.",
  AccessControlUnauthorizedAccount: "This account is not allowed to perform that action.",
};

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

export function toFriendlyError(error: unknown, fallback = "Something went wrong."): FriendlyError {
  const code = revertName(error);
  if (code && FRIENDLY[code]) return { message: FRIENDLY[code], code };
  if (code) return { message: fallback, code };

  const message = error instanceof Error ? error.message : "";
  if (/insufficient funds/i.test(message)) {
    return {
      message: "The city's transaction account has run out of test funds. Please top it up.",
      code: "InsufficientFunds",
    };
  }
  if (/fetch failed|ECONNREFUSED|network/i.test(message)) {
    return {
      message: "Could not reach the network right now. Please try again in a moment.",
      code: "NetworkUnavailable",
    };
  }
  return { message: fallback, code: null };
}

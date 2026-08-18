/**
 * QR payload format.
 *
 * Deliberately simple and deliberately not a secret. A scanner extracts an identifier and then
 * asks the contract about it; the code itself grants nothing.
 */

const USER_PREFIX = "cityquest://user/";
const TICKET_PREFIX = "cityquest://ticket/";

export function userQrPayload(wallet: string): string {
  return `${USER_PREFIX}${wallet}`;
}

export function ticketQrPayload(passId: string): string {
  return `${TICKET_PREFIX}${passId}`;
}

/** Accepts a scanned string or something typed by hand, and works out what it is. */
export function parseQrPayload(
  raw: string,
): { kind: "user"; wallet: string } | { kind: "ticket"; passId: string } | null {
  const value = raw.trim();

  if (value.startsWith(USER_PREFIX)) {
    const wallet = value.slice(USER_PREFIX.length).trim();
    return /^0x[a-fA-F0-9]{40}$/.test(wallet) ? { kind: "user", wallet } : null;
  }
  if (value.startsWith(TICKET_PREFIX)) {
    const passId = value.slice(TICKET_PREFIX.length).trim();
    return /^\d+$/.test(passId) ? { kind: "ticket", passId } : null;
  }

  // Typed by hand at the desk: a bare address or a bare ticket number.
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) return { kind: "user", wallet: value };
  if (/^\d+$/.test(value)) return { kind: "ticket", passId: value };

  return null;
}

/**
 * Period identifiers, shared by the contract and the database.
 *
 * A "daily" activity uses the day number since the Unix epoch, which is exactly what the
 * contract folds into its record key. A "once" activity uses 0, meaning once ever.
 *
 * Day boundaries are UTC. A city running this for real would use its own timezone so that
 * "today" matches opening hours; that is a one-line change here and needs no contract change,
 * because the contract only ever sees an opaque number.
 */

export type Cadence = "daily" | "once";

export function periodIdFor(cadence: Cadence, at: Date = new Date()): bigint {
  return cadence === "daily" ? BigInt(Math.floor(at.getTime() / 86_400_000)) : 0n;
}

/** Human-readable twin of periodId, used as the database uniqueness key. */
export function periodKeyFor(cadence: Cadence, at: Date = new Date()): string {
  return cadence === "daily" ? at.toISOString().slice(0, 10) : "once";
}

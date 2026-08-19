import { db } from "@/server/db";
import type { CatalogActivity } from "@/server/catalog";

/**
 * What a ticket costs right now.
 *
 * The catalogue holds the launch price; the database holds whatever the municipality has changed
 * it to since. Reading them in that order means a city can reprice a ticket during the school
 * holidays without a deploy, and a fresh install still has sensible prices with an empty table.
 */

export type PriceMap = Map<string, number>;

export async function loadPrices(): Promise<PriceMap> {
  const overrides = await db().listActivityPrices();
  return new Map(overrides.map((entry) => [entry.activitySlug, entry.priceTry]));
}

/** The effective price, in lira. Zero means free. */
export function priceFor(activity: CatalogActivity, prices: PriceMap): number {
  return prices.get(activity.slug) ?? activity.priceTry ?? 0;
}

/** Convenience for the single-activity paths, where loading the whole map would be wasteful. */
export async function priceForSlug(activity: CatalogActivity): Promise<number> {
  const overrides = await db().listActivityPrices();
  const override = overrides.find((entry) => entry.activitySlug === activity.slug);
  return override?.priceTry ?? activity.priceTry ?? 0;
}

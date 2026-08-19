/**
 * Everything the database stores. Note what is absent: no full name, no school, no age, no
 * phone number, no address, no location history. A display name and an emoji are enough to make
 * a leaderboard feel personal, and they are all we are willing to hold about a child.
 */

export interface Profile {
  wallet: string;
  displayName: string;
  avatarEmoji: string;
  xp: number;
  createdAt: string;
}

export interface Completion {
  id: string;
  wallet: string;
  activitySlug: string;
  institutionSlug: string;
  /** "2026-08-18" for daily activities, "once" for one-time ones. Mirrors the on-chain period. */
  periodKey: string;
  xpAwarded: number;
  /** Null for purely off-chain activities such as the quiz. */
  txHash: string | null;
  createdAt: string;
}

export type TicketStatus = "valid" | "used" | "cancelled";

export interface TicketOrder {
  id: string;
  wallet: string;
  activitySlug: string;
  /** On-chain pass id. The contract is the source of truth for status; this is a mirror. */
  passId: string;
  priceTry: number;
  status: TicketStatus;
  issueTxHash: string | null;
  consumeTxHash: string | null;
  createdAt: string;
}

/**
 * A ticket price the municipality has changed.
 *
 * Only overrides live here; an activity with no row keeps the price from the catalogue. That
 * way the demo has sensible prices out of the box and an empty table is a valid state, rather
 * than every price having to be seeded before anything can be sold.
 *
 * Lira, charged through ordinary payment rails. Deliberately never on-chain: putting a price in
 * a contract would make this a token project, which is the one thing it is not.
 */
export interface ActivityPrice {
  activitySlug: string;
  priceTry: number;
  updatedAt: string;
}

/**
 * A business that has joined the city's ecosystem.
 *
 * A sponsor is not an institution: it issues nothing, holds no key, and appears nowhere in the
 * registry contract. It only *reads* what institutions have already vouched for and decides on
 * its own terms that it is worth a coffee. That asymmetry is the point -- a cafe should be able
 * to trust a library's word without the library, the cafe and the city app all having to be the
 * same organisation.
 *
 * The municipality approves a business before its offers become visible, so joining the
 * ecosystem is not the same as being trusted by it.
 */
export interface Sponsor {
  slug: string;
  name: string;
  emoji: string;
  /** DEMO MOCK -- a shared code the business's staff type in. Real accounts in production. */
  accessCode: string;
  approved: boolean;
  createdAt: string;
}

/**
 * What a business asks for in return.
 *
 * "credential" is the strong form: the achievement is on-chain, so the business can verify it
 * itself without taking our word for anything. "visits" is counted by the city app from its own
 * records, which is weaker, and the interface says so rather than pretending otherwise.
 */
export type OfferRequirement =
  | { kind: "credential"; credential: string }
  | { kind: "visits"; activitySlug: string; count: number };

export interface SponsorOffer {
  slug: string;
  sponsorSlug: string;
  /** Written by the business in its own words, so a single string rather than a Localized. */
  title: string;
  description: string;
  emoji: string;
  requirement: OfferRequirement;
  active: boolean;
  createdAt: string;
}

export interface NewSponsor {
  name: string;
  emoji: string;
}

export interface NewSponsorOffer {
  sponsorSlug: string;
  title: string;
  description: string;
  emoji: string;
  requirement: OfferRequirement;
}

export interface RewardClaim {
  id: string;
  wallet: string;
  rewardSlug: string;
  couponCode: string;
  createdAt: string;
}

export interface NewCompletion {
  wallet: string;
  activitySlug: string;
  institutionSlug: string;
  periodKey: string;
  xpAwarded: number;
  txHash: string | null;
}

export interface NewTicketOrder {
  wallet: string;
  activitySlug: string;
  passId: string;
  priceTry: number;
  issueTxHash: string | null;
}

export interface ProfilePatch {
  displayName?: string;
  avatarEmoji?: string;
}

/**
 * The whole persistence surface. Kept deliberately small so that swapping Postgres for anything
 * else stays a one-file job.
 */
export interface Database {
  getProfile(wallet: string): Promise<Profile | null>;
  upsertProfile(wallet: string, patch?: ProfilePatch): Promise<Profile>;
  addXp(wallet: string, amount: number): Promise<Profile>;
  leaderboard(limit: number): Promise<Profile[]>;

  recordCompletion(completion: NewCompletion): Promise<Completion>;
  findCompletion(
    wallet: string,
    activitySlug: string,
    periodKey: string,
  ): Promise<Completion | null>;
  listCompletions(wallet: string): Promise<Completion[]>;
  listRecentCompletions(limit: number, institutionSlug?: string): Promise<Completion[]>;

  createTicketOrder(order: NewTicketOrder): Promise<TicketOrder>;
  listTicketOrders(wallet: string): Promise<TicketOrder[]>;
  findTicketOrderByPassId(passId: string): Promise<TicketOrder | null>;
  /** How many tickets the whole city has issued since a moment. Used to cap relayer spending. */
  countTicketOrdersSince(iso: string): Promise<number>;
  markTicketConsumed(passId: string, txHash: string): Promise<void>;

  listSponsors(): Promise<Sponsor[]>;
  findSponsor(slug: string): Promise<Sponsor | null>;
  createSponsor(sponsor: NewSponsor): Promise<Sponsor>;
  setSponsorApproved(slug: string, approved: boolean): Promise<Sponsor>;

  listSponsorOffers(sponsorSlug?: string): Promise<SponsorOffer[]>;
  findSponsorOffer(slug: string): Promise<SponsorOffer | null>;
  createSponsorOffer(offer: NewSponsorOffer): Promise<SponsorOffer>;
  setSponsorOfferActive(slug: string, active: boolean): Promise<SponsorOffer>;

  listActivityPrices(): Promise<ActivityPrice[]>;
  setActivityPrice(activitySlug: string, priceTry: number): Promise<ActivityPrice>;
  clearActivityPrice(activitySlug: string): Promise<void>;

  createRewardClaim(wallet: string, rewardSlug: string, couponCode: string): Promise<RewardClaim>;
  findRewardClaim(wallet: string, rewardSlug: string): Promise<RewardClaim | null>;
  listRewardClaims(wallet: string): Promise<RewardClaim[]>;
}

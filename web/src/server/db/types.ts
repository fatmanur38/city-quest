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
  findCompletion(wallet: string, activitySlug: string, periodKey: string): Promise<Completion | null>;
  listCompletions(wallet: string): Promise<Completion[]>;
  listRecentCompletions(limit: number, institutionSlug?: string): Promise<Completion[]>;

  createTicketOrder(order: NewTicketOrder): Promise<TicketOrder>;
  listTicketOrders(wallet: string): Promise<TicketOrder[]>;
  findTicketOrderByPassId(passId: string): Promise<TicketOrder | null>;
  markTicketConsumed(passId: string, txHash: string): Promise<void>;

  createRewardClaim(wallet: string, rewardSlug: string, couponCode: string): Promise<RewardClaim>;
  findRewardClaim(wallet: string, rewardSlug: string): Promise<RewardClaim | null>;
  listRewardClaims(wallet: string): Promise<RewardClaim[]>;
}

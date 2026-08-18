import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Completion,
  Database,
  NewCompletion,
  NewTicketOrder,
  Profile,
  ProfilePatch,
  RewardClaim,
  TicketOrder,
} from "./types";

/**
 * Postgres via Supabase. Uses the service-role key, so this module must only ever be imported
 * from server code -- it bypasses row-level security by design, because every write here has
 * already been authorised by a session check or an institution signature.
 *
 * Table definitions live in supabase/migrations/0001_init.sql.
 */

interface ProfileRow {
  wallet: string;
  display_name: string;
  avatar_emoji: string;
  xp: number;
  created_at: string;
}

interface CompletionRow {
  id: string;
  wallet: string;
  activity_slug: string;
  institution_slug: string;
  period_key: string;
  xp_awarded: number;
  tx_hash: string | null;
  created_at: string;
}

interface TicketOrderRow {
  id: string;
  wallet: string;
  activity_slug: string;
  pass_id: string;
  price_try: number;
  status: TicketOrder["status"];
  issue_tx_hash: string | null;
  consume_tx_hash: string | null;
  created_at: string;
}

interface RewardClaimRow {
  id: string;
  wallet: string;
  reward_slug: string;
  coupon_code: string;
  created_at: string;
}

const DEFAULT_AVATARS = ["🦊", "🐙", "🦉", "🐝", "🦄", "🐢", "🦖", "🐬"];

function toProfile(row: ProfileRow): Profile {
  return {
    wallet: row.wallet,
    displayName: row.display_name,
    avatarEmoji: row.avatar_emoji,
    xp: row.xp,
    createdAt: row.created_at,
  };
}

function toCompletion(row: CompletionRow): Completion {
  return {
    id: row.id,
    wallet: row.wallet,
    activitySlug: row.activity_slug,
    institutionSlug: row.institution_slug,
    periodKey: row.period_key,
    xpAwarded: row.xp_awarded,
    txHash: row.tx_hash,
    createdAt: row.created_at,
  };
}

function toTicketOrder(row: TicketOrderRow): TicketOrder {
  return {
    id: row.id,
    wallet: row.wallet,
    activitySlug: row.activity_slug,
    passId: row.pass_id,
    priceTry: row.price_try,
    status: row.status,
    issueTxHash: row.issue_tx_hash,
    consumeTxHash: row.consume_tx_hash,
    createdAt: row.created_at,
  };
}

function toRewardClaim(row: RewardClaimRow): RewardClaim {
  return {
    id: row.id,
    wallet: row.wallet,
    rewardSlug: row.reward_slug,
    couponCode: row.coupon_code,
    createdAt: row.created_at,
  };
}

export class SupabaseDatabase implements Database {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private key(wallet: string): string {
    return wallet.toLowerCase();
  }

  async getProfile(wallet: string): Promise<Profile | null> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("wallet", this.key(wallet))
      .maybeSingle<ProfileRow>();
    if (error) throw new Error(`getProfile: ${error.message}`);
    return data ? toProfile(data) : null;
  }

  async upsertProfile(wallet: string, patch: ProfilePatch = {}): Promise<Profile> {
    const key = this.key(wallet);
    const existing = await this.getProfile(key);

    if (existing) {
      if (patch.displayName === undefined && patch.avatarEmoji === undefined) return existing;
      const { data, error } = await this.client
        .from("profiles")
        .update({
          ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
          ...(patch.avatarEmoji !== undefined ? { avatar_emoji: patch.avatarEmoji } : {}),
        })
        .eq("wallet", key)
        .select()
        .single<ProfileRow>();
      if (error) throw new Error(`upsertProfile: ${error.message}`);
      return toProfile(data);
    }

    const avatarIndex = Number.parseInt(key.slice(-2), 16) % DEFAULT_AVATARS.length;
    const { data, error } = await this.client
      .from("profiles")
      .insert({
        wallet: key,
        display_name: patch.displayName ?? `Explorer ${key.slice(2, 6).toUpperCase()}`,
        avatar_emoji: patch.avatarEmoji ?? DEFAULT_AVATARS[avatarIndex] ?? "🦊",
        xp: 0,
      })
      .select()
      .single<ProfileRow>();
    if (error) throw new Error(`upsertProfile: ${error.message}`);
    return toProfile(data);
  }

  async addXp(wallet: string, amount: number): Promise<Profile> {
    const key = this.key(wallet);
    await this.upsertProfile(key);
    // Atomic increment, so two check-ins landing at once cannot lose points.
    const { data, error } = await this.client
      .rpc("increment_xp", { p_wallet: key, p_amount: amount })
      .select()
      .single<ProfileRow>();
    if (error) throw new Error(`addXp: ${error.message}`);
    return toProfile(data);
  }

  async leaderboard(limit: number): Promise<Profile[]> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .order("xp", { ascending: false })
      .limit(limit)
      .returns<ProfileRow[]>();
    if (error) throw new Error(`leaderboard: ${error.message}`);
    return (data ?? []).map(toProfile);
  }

  async recordCompletion(completion: NewCompletion): Promise<Completion> {
    const { data, error } = await this.client
      .from("activity_completions")
      .insert({
        wallet: this.key(completion.wallet),
        activity_slug: completion.activitySlug,
        institution_slug: completion.institutionSlug,
        period_key: completion.periodKey,
        xp_awarded: completion.xpAwarded,
        tx_hash: completion.txHash,
      })
      .select()
      .single<CompletionRow>();
    if (error) throw new Error(`recordCompletion: ${error.message}`);
    return toCompletion(data);
  }

  async findCompletion(
    wallet: string,
    activitySlug: string,
    periodKey: string,
  ): Promise<Completion | null> {
    const { data, error } = await this.client
      .from("activity_completions")
      .select("*")
      .eq("wallet", this.key(wallet))
      .eq("activity_slug", activitySlug)
      .eq("period_key", periodKey)
      .maybeSingle<CompletionRow>();
    if (error) throw new Error(`findCompletion: ${error.message}`);
    return data ? toCompletion(data) : null;
  }

  async listCompletions(wallet: string): Promise<Completion[]> {
    const { data, error } = await this.client
      .from("activity_completions")
      .select("*")
      .eq("wallet", this.key(wallet))
      .order("created_at", { ascending: false })
      .returns<CompletionRow[]>();
    if (error) throw new Error(`listCompletions: ${error.message}`);
    return (data ?? []).map(toCompletion);
  }

  async listRecentCompletions(limit: number, institutionSlug?: string): Promise<Completion[]> {
    let query = this.client
      .from("activity_completions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (institutionSlug) query = query.eq("institution_slug", institutionSlug);
    const { data, error } = await query.returns<CompletionRow[]>();
    if (error) throw new Error(`listRecentCompletions: ${error.message}`);
    return (data ?? []).map(toCompletion);
  }

  async createTicketOrder(order: NewTicketOrder): Promise<TicketOrder> {
    const { data, error } = await this.client
      .from("ticket_orders")
      .insert({
        wallet: this.key(order.wallet),
        activity_slug: order.activitySlug,
        pass_id: order.passId,
        price_try: order.priceTry,
        status: "valid",
        issue_tx_hash: order.issueTxHash,
      })
      .select()
      .single<TicketOrderRow>();
    if (error) throw new Error(`createTicketOrder: ${error.message}`);
    return toTicketOrder(data);
  }

  async listTicketOrders(wallet: string): Promise<TicketOrder[]> {
    const { data, error } = await this.client
      .from("ticket_orders")
      .select("*")
      .eq("wallet", this.key(wallet))
      .order("created_at", { ascending: false })
      .returns<TicketOrderRow[]>();
    if (error) throw new Error(`listTicketOrders: ${error.message}`);
    return (data ?? []).map(toTicketOrder);
  }

  async findTicketOrderByPassId(passId: string): Promise<TicketOrder | null> {
    const { data, error } = await this.client
      .from("ticket_orders")
      .select("*")
      .eq("pass_id", passId)
      .maybeSingle<TicketOrderRow>();
    if (error) throw new Error(`findTicketOrderByPassId: ${error.message}`);
    return data ? toTicketOrder(data) : null;
  }

  async markTicketConsumed(passId: string, txHash: string): Promise<void> {
    const { error } = await this.client
      .from("ticket_orders")
      .update({ status: "used", consume_tx_hash: txHash })
      .eq("pass_id", passId);
    if (error) throw new Error(`markTicketConsumed: ${error.message}`);
  }

  async createRewardClaim(
    wallet: string,
    rewardSlug: string,
    couponCode: string,
  ): Promise<RewardClaim> {
    const { data, error } = await this.client
      .from("reward_claims")
      .insert({ wallet: this.key(wallet), reward_slug: rewardSlug, coupon_code: couponCode })
      .select()
      .single<RewardClaimRow>();
    if (error) throw new Error(`createRewardClaim: ${error.message}`);
    return toRewardClaim(data);
  }

  async findRewardClaim(wallet: string, rewardSlug: string): Promise<RewardClaim | null> {
    const { data, error } = await this.client
      .from("reward_claims")
      .select("*")
      .eq("wallet", this.key(wallet))
      .eq("reward_slug", rewardSlug)
      .maybeSingle<RewardClaimRow>();
    if (error) throw new Error(`findRewardClaim: ${error.message}`);
    return data ? toRewardClaim(data) : null;
  }

  async listRewardClaims(wallet: string): Promise<RewardClaim[]> {
    const { data, error } = await this.client
      .from("reward_claims")
      .select("*")
      .eq("wallet", this.key(wallet))
      .returns<RewardClaimRow[]>();
    if (error) throw new Error(`listRewardClaims: ${error.message}`);
    return (data ?? []).map(toRewardClaim);
  }
}

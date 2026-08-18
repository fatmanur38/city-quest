import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
 * DEMO FALLBACK -- a JSON file standing in for Postgres.
 *
 * Used automatically when SUPABASE_URL is not set, so `npm run dev` works on a fresh clone with
 * no accounts to create and nothing to provision. It persists to `.data/cityquest.json` so a
 * dev-server restart does not wipe the demo halfway through a run-through.
 *
 * In production this is replaced by SupabaseDatabase (same interface, same call sites). It is
 * single-process and not safe for concurrent writers, which is exactly why it is not the
 * default when real credentials are present.
 */

interface Snapshot {
  profiles: Profile[];
  completions: Completion[];
  ticketOrders: TicketOrder[];
  rewardClaims: RewardClaim[];
}

const EMPTY: Snapshot = { profiles: [], completions: [], ticketOrders: [], rewardClaims: [] };

const DEFAULT_AVATARS = ["🦊", "🐙", "🦉", "🐝", "🦄", "🐢", "🦖", "🐬"];

function defaultName(wallet: string): string {
  return `Explorer ${wallet.slice(2, 6).toUpperCase()}`;
}

function defaultAvatar(wallet: string): string {
  const index = Number.parseInt(wallet.slice(-2), 16) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[index] ?? "🦊";
}

export class MemoryDatabase implements Database {
  private readonly file: string;
  private data: Snapshot;

  constructor(file = resolve(process.cwd(), ".data/cityquest.json")) {
    this.file = file;
    this.data = this.load();
  }

  private load(): Snapshot {
    try {
      if (existsSync(this.file)) {
        return { ...EMPTY, ...(JSON.parse(readFileSync(this.file, "utf8")) as Snapshot) };
      }
    } catch (error) {
      console.error("[db] could not read local store, starting empty", error);
    }
    return structuredClone(EMPTY);
  }

  private persist(): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error("[db] could not persist local store", error);
    }
  }

  private key(wallet: string): string {
    return wallet.toLowerCase();
  }

  async getProfile(wallet: string): Promise<Profile | null> {
    return this.data.profiles.find((p) => p.wallet === this.key(wallet)) ?? null;
  }

  async upsertProfile(wallet: string, patch: ProfilePatch = {}): Promise<Profile> {
    const key = this.key(wallet);
    let profile = this.data.profiles.find((p) => p.wallet === key);
    if (!profile) {
      profile = {
        wallet: key,
        displayName: patch.displayName ?? defaultName(key),
        avatarEmoji: patch.avatarEmoji ?? defaultAvatar(key),
        xp: 0,
        createdAt: new Date().toISOString(),
      };
      this.data.profiles.push(profile);
    } else {
      if (patch.displayName !== undefined) profile.displayName = patch.displayName;
      if (patch.avatarEmoji !== undefined) profile.avatarEmoji = patch.avatarEmoji;
    }
    this.persist();
    return { ...profile };
  }

  async addXp(wallet: string, amount: number): Promise<Profile> {
    const profile = await this.upsertProfile(wallet);
    const stored = this.data.profiles.find((p) => p.wallet === profile.wallet);
    if (stored) {
      stored.xp += amount;
      this.persist();
      return { ...stored };
    }
    return profile;
  }

  async leaderboard(limit: number): Promise<Profile[]> {
    return [...this.data.profiles].sort((a, b) => b.xp - a.xp).slice(0, limit);
  }

  async recordCompletion(completion: NewCompletion): Promise<Completion> {
    const row: Completion = {
      id: randomUUID(),
      ...completion,
      wallet: this.key(completion.wallet),
      createdAt: new Date().toISOString(),
    };
    this.data.completions.push(row);
    this.persist();
    return row;
  }

  async findCompletion(
    wallet: string,
    activitySlug: string,
    periodKey: string,
  ): Promise<Completion | null> {
    return (
      this.data.completions.find(
        (c) =>
          c.wallet === this.key(wallet) && c.activitySlug === activitySlug && c.periodKey === periodKey,
      ) ?? null
    );
  }

  async listCompletions(wallet: string): Promise<Completion[]> {
    return this.data.completions
      .filter((c) => c.wallet === this.key(wallet))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listRecentCompletions(limit: number, institutionSlug?: string): Promise<Completion[]> {
    return this.data.completions
      .filter((c) => !institutionSlug || c.institutionSlug === institutionSlug)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async createTicketOrder(order: NewTicketOrder): Promise<TicketOrder> {
    const row: TicketOrder = {
      id: randomUUID(),
      ...order,
      wallet: this.key(order.wallet),
      status: "valid",
      consumeTxHash: null,
      createdAt: new Date().toISOString(),
    };
    this.data.ticketOrders.push(row);
    this.persist();
    return row;
  }

  async listTicketOrders(wallet: string): Promise<TicketOrder[]> {
    return this.data.ticketOrders
      .filter((t) => t.wallet === this.key(wallet))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findTicketOrderByPassId(passId: string): Promise<TicketOrder | null> {
    return this.data.ticketOrders.find((t) => t.passId === passId) ?? null;
  }

  async markTicketConsumed(passId: string, txHash: string): Promise<void> {
    const order = this.data.ticketOrders.find((t) => t.passId === passId);
    if (order) {
      order.status = "used";
      order.consumeTxHash = txHash;
      this.persist();
    }
  }

  async createRewardClaim(
    wallet: string,
    rewardSlug: string,
    couponCode: string,
  ): Promise<RewardClaim> {
    const row: RewardClaim = {
      id: randomUUID(),
      wallet: this.key(wallet),
      rewardSlug,
      couponCode,
      createdAt: new Date().toISOString(),
    };
    this.data.rewardClaims.push(row);
    this.persist();
    return row;
  }

  async findRewardClaim(wallet: string, rewardSlug: string): Promise<RewardClaim | null> {
    return (
      this.data.rewardClaims.find(
        (c) => c.wallet === this.key(wallet) && c.rewardSlug === rewardSlug,
      ) ?? null
    );
  }

  async listRewardClaims(wallet: string): Promise<RewardClaim[]> {
    return this.data.rewardClaims.filter((c) => c.wallet === this.key(wallet));
  }
}

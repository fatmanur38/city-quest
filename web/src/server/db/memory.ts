import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  ActivityPrice,
  LinkedAccount,
  Completion,
  NewSponsor,
  NewSponsorOffer,
  Database,
  NewCompletion,
  NewTicketOrder,
  Profile,
  ProfilePatch,
  RewardClaim,
  Sponsor,
  SponsorOffer,
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
  activityPrices: ActivityPrice[];
  sponsors: Sponsor[];
  sponsorOffers: SponsorOffer[];
  linkedAccounts: LinkedAccount[];
}

const EMPTY: Snapshot = {
  profiles: [],
  completions: [],
  ticketOrders: [],
  rewardClaims: [],
  linkedAccounts: [],
  activityPrices: [],
  sponsors: [],
  sponsorOffers: [],
};

const DEFAULT_AVATARS = ["🦊", "🐙", "🦉", "🐝", "🦄", "🐢", "🦖", "🐬"];

/** URL-safe, collision-free and readable, which is all a slug has to be here. */
function slugify(value: string, taken: string[]): string {
  const base =
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "sponsor";
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** DEMO MOCK -- the code a business's staff type in. Real accounts replace this in production. */
function accessCode(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function defaultName(wallet: string): string {
  return `Explorer ${wallet.slice(2, 6).toUpperCase()}`;
}

function defaultAvatar(wallet: string): string {
  const index = Number.parseInt(wallet.slice(-2), 16) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[index] ?? "🦊";
}

export class MemoryDatabase implements Database {
  private readonly file: string;
  private snapshot: Snapshot;
  private mtimeMs = 0;

  constructor(file = resolve(process.cwd(), ".data/cityquest.json")) {
    this.file = file;
    this.snapshot = this.load();
    this.mtimeMs = this.currentMtime();
  }

  /**
   * Re-reads the file when something else has written to it.
   *
   * Next gives different route bundles their own module registry in development, so the route
   * handler that writes and the page that reads can end up holding two separate instances of
   * this class. Without this check the reader keeps serving whatever it loaded at construction
   * and a change made in the admin console never shows up on the public page.
   */
  private get data(): Snapshot {
    const mtime = this.currentMtime();
    if (mtime !== this.mtimeMs) {
      this.snapshot = this.load();
      this.mtimeMs = mtime;
    }
    return this.snapshot;
  }

  private currentMtime(): number {
    try {
      return statSync(this.file).mtimeMs;
    } catch {
      return 0;
    }
  }

  private load(): Snapshot {
    try {
      if (existsSync(this.file)) {
        return {
          ...EMPTY,
          ...(JSON.parse(readFileSync(this.file, "utf8")) as Snapshot),
        };
      }
    } catch (error) {
      console.error("[db] could not read local store, starting empty", error);
    }
    return structuredClone(EMPTY);
  }

  private persist(): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      // Writes `snapshot` rather than `data`: going through the getter here could reload the
      // file and throw away the change that is being saved.
      writeFileSync(this.file, JSON.stringify(this.snapshot, null, 2));
      this.mtimeMs = this.currentMtime();
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
        displayName: patch.displayName ?? patch.defaultDisplayName ?? defaultName(key),
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
          c.wallet === this.key(wallet) &&
          c.activitySlug === activitySlug &&
          c.periodKey === periodKey,
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

  async countTicketOrdersSince(iso: string): Promise<number> {
    return this.data.ticketOrders.filter((order) => order.createdAt >= iso).length;
  }

  async markTicketConsumed(passId: string, txHash: string): Promise<void> {
    const order = this.data.ticketOrders.find((t) => t.passId === passId);
    if (order) {
      order.status = "used";
      order.consumeTxHash = txHash;
      this.persist();
    }
  }

  // ------------------------------------------------------------------------------------- Sponsors

  async listSponsors(): Promise<Sponsor[]> {
    return structuredClone(this.data.sponsors);
  }

  async findSponsor(slug: string): Promise<Sponsor | null> {
    const found = this.data.sponsors.find((sponsor) => sponsor.slug === slug);
    return found ? structuredClone(found) : null;
  }

  async createSponsor(sponsor: NewSponsor): Promise<Sponsor> {
    const record: Sponsor = {
      slug: slugify(
        sponsor.name,
        this.data.sponsors.map((s) => s.slug),
      ),
      name: sponsor.name,
      emoji: sponsor.emoji,
      accessCode: accessCode(),
      // A business is visible to citizens only once the municipality has approved it.
      approved: false,
      createdAt: new Date().toISOString(),
    };
    this.data.sponsors.push(record);
    this.persist();
    return structuredClone(record);
  }

  async setSponsorApproved(slug: string, approved: boolean): Promise<Sponsor> {
    const sponsor = this.data.sponsors.find((entry) => entry.slug === slug);
    if (!sponsor) throw new Error("No such sponsor.");
    sponsor.approved = approved;
    this.persist();
    return structuredClone(sponsor);
  }

  async listSponsorOffers(sponsorSlug?: string): Promise<SponsorOffer[]> {
    const offers = sponsorSlug
      ? this.data.sponsorOffers.filter((offer) => offer.sponsorSlug === sponsorSlug)
      : this.data.sponsorOffers;
    return structuredClone(offers);
  }

  async findSponsorOffer(slug: string): Promise<SponsorOffer | null> {
    const found = this.data.sponsorOffers.find((offer) => offer.slug === slug);
    return found ? structuredClone(found) : null;
  }

  async createSponsorOffer(offer: NewSponsorOffer): Promise<SponsorOffer> {
    const record: SponsorOffer = {
      slug: slugify(
        `${offer.sponsorSlug}-${offer.title}`,
        this.data.sponsorOffers.map((o) => o.slug),
      ),
      sponsorSlug: offer.sponsorSlug,
      title: offer.title,
      description: offer.description,
      emoji: offer.emoji,
      requirement: offer.requirement,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.data.sponsorOffers.push(record);
    this.persist();
    return structuredClone(record);
  }

  async setSponsorOfferActive(slug: string, active: boolean): Promise<SponsorOffer> {
    const offer = this.data.sponsorOffers.find((entry) => entry.slug === slug);
    if (!offer) throw new Error("No such offer.");
    offer.active = active;
    this.persist();
    return structuredClone(offer);
  }

  async listActivityPrices(): Promise<ActivityPrice[]> {
    return structuredClone(this.data.activityPrices);
  }

  async setActivityPrice(activitySlug: string, priceTry: number): Promise<ActivityPrice> {
    const record: ActivityPrice = {
      activitySlug,
      priceTry,
      updatedAt: new Date().toISOString(),
    };
    const existing = this.data.activityPrices.findIndex((p) => p.activitySlug === activitySlug);
    if (existing >= 0) this.data.activityPrices[existing] = record;
    else this.data.activityPrices.push(record);
    this.persist();
    return structuredClone(record);
  }

  async clearActivityPrice(activitySlug: string): Promise<void> {
    this.data.activityPrices = this.data.activityPrices.filter(
      (p) => p.activitySlug !== activitySlug,
    );
    this.persist();
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

  async findLinkByProvider(
    provider: "google",
    providerUserId: string,
  ): Promise<LinkedAccount | null> {
    return (
      (this.data.linkedAccounts ?? []).find(
        (l) => l.provider === provider && l.providerUserId === providerUserId,
      ) ?? null
    );
  }

  async findLinkByWallet(provider: "google", wallet: string): Promise<LinkedAccount | null> {
    return (
      (this.data.linkedAccounts ?? []).find(
        (l) => l.provider === provider && l.wallet === this.key(wallet),
      ) ?? null
    );
  }

  async createLink(
    provider: "google",
    providerUserId: string,
    wallet: string,
  ): Promise<LinkedAccount> {
    const row: LinkedAccount = {
      provider,
      providerUserId,
      wallet: this.key(wallet),
      createdAt: new Date().toISOString(),
    };
    // A JSON file written before this table existed has no array to push onto.
    this.data.linkedAccounts ??= [];
    this.data.linkedAccounts.push(row);
    this.persist();
    return row;
  }
}

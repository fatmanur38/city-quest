import { db } from "@/server/db";
import { REWARDS, activityBySlug, type CatalogReward } from "@/server/catalog";
import { CREDENTIALS, type CredentialName } from "@/lib/credentials";
import { hasCredential } from "@/lib/chain/reads";
import { pick, type Locale } from "@/lib/i18n/types";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { OfferRequirement, SponsorOffer } from "@/server/db/types";

/**
 * Every offer a citizen can see, from both sources.
 *
 * The catalogue holds the ones this repository ships with; the database holds the ones
 * businesses have created for themselves. They are merged into one shape here so the rewards
 * page does not have to care which is which -- from a citizen's point of view there is no
 * difference, and from a sponsor's the whole point is that joining takes a form and not a pull
 * request.
 */

export type Verification = "chain" | "app";

export interface RewardView {
  slug: string;
  sponsorName: string;
  sponsorIcon: string;
  title: string;
  description: string;
  icon: string;
  /** What the citizen still has to do, in their language. */
  requirementLabel: string;
  /**
   * "chain" means the business can check this itself against the registry without trusting us.
   * "app" means we counted it. The interface shows the difference rather than blurring it.
   */
  verification: Verification;
  source: "catalog" | "sponsor";
  /** Kept so eligibility can be evaluated without re-reading where the offer came from. */
  requirement: OfferRequirement;
}

function fromCatalog(reward: CatalogReward, locale: Locale): RewardView {
  const required = CREDENTIALS[reward.requiredCredential];
  return {
    slug: reward.slug,
    sponsorName: reward.sponsorName,
    sponsorIcon: "store",
    title: pick(reward.title, locale),
    description: pick(reward.description, locale),
    icon: reward.icon,
    requirementLabel: pick(required.title, locale),
    verification: "chain",
    source: "catalog",
    requirement: { kind: "credential", credential: reward.requiredCredential },
  };
}

/** Human wording for a requirement a business chose. */
export function requirementLabel(requirement: OfferRequirement, locale: Locale): string {
  const t = getDictionary(locale);
  if (requirement.kind === "credential") {
    const credential = CREDENTIALS[requirement.credential as CredentialName];
    return credential ? pick(credential.title, locale) : requirement.credential;
  }
  const activity = activityBySlug(requirement.activitySlug);
  const name = activity ? pick(activity.title, locale) : requirement.activitySlug;
  return t.sponsor.visitsRequirement(name, requirement.count);
}

function fromOffer(
  offer: SponsorOffer,
  sponsorName: string,
  sponsorIcon: string,
  locale: Locale,
): RewardView {
  return {
    slug: offer.slug,
    sponsorName,
    sponsorIcon,
    title: offer.title,
    description: offer.description,
    icon: offer.icon,
    requirementLabel: requirementLabel(offer.requirement, locale),
    verification: offer.requirement.kind === "credential" ? "chain" : "app",
    source: "sponsor",
    requirement: offer.requirement,
  };
}

/** Catalogue offers first, then whatever approved businesses have published. */
export async function loadRewards(locale: Locale): Promise<RewardView[]> {
  const [sponsors, offers] = await Promise.all([db().listSponsors(), db().listSponsorOffers()]);
  const approved = new Map(sponsors.filter((s) => s.approved).map((s) => [s.slug, s]));

  const published = offers
    .filter((offer) => offer.active && approved.has(offer.sponsorSlug))
    .map((offer) => {
      const sponsor = approved.get(offer.sponsorSlug)!;
      return fromOffer(offer, sponsor.name, sponsor.icon, locale);
    });

  return [...REWARDS.map((reward) => fromCatalog(reward, locale)), ...published];
}

/**
 * Whether a citizen has earned an offer.
 *
 * A credential is read from the chain, which is the form a business could check for itself. A
 * visit count is read from our own completion records, which it could not -- so anything built
 * on this number is only as trustworthy as the city app, and the interface labels it that way.
 */
export async function meetsRequirement(
  wallet: `0x${string}`,
  requirement: OfferRequirement,
): Promise<boolean> {
  if (requirement.kind === "credential") {
    const credential = CREDENTIALS[requirement.credential as CredentialName];
    if (!credential) return false;
    return hasCredential(wallet, credential.hash);
  }

  const completions = await db().listCompletions(wallet);
  const visits = completions.filter(
    (completion) => completion.activitySlug === requirement.activitySlug,
  ).length;
  return visits >= requirement.count;
}

/** How far along a citizen is, for the "3 of 5" line on the card. */
export async function requirementProgress(
  wallet: `0x${string}`,
  requirement: OfferRequirement,
): Promise<{ done: number; total: number } | null> {
  if (requirement.kind !== "visits") return null;
  const completions = await db().listCompletions(wallet);
  const visits = completions.filter(
    (completion) => completion.activitySlug === requirement.activitySlug,
  ).length;
  return {
    done: Math.min(visits, requirement.count),
    total: requirement.count,
  };
}

export interface RewardStatus extends RewardView {
  eligible: boolean;
  /** The coupon already granted, if there is one. */
  couponCode: string | null;
  /** Only meaningful for visit counts, where "3 of 5" is worth showing. */
  progress: { done: number; total: number } | null;
}

/**
 * The rewards page's whole data set in one call.
 *
 * Eligibility is evaluated per offer rather than cached, because a credential check is a read
 * against the registry contract and that is the fact the citizen is actually being shown. A
 * coupon that was already granted short-circuits it: once a business has made a promise, we do
 * not re-litigate whether it should have.
 */
export async function loadRewardsFor(
  wallet: `0x${string}` | null,
  locale: Locale,
): Promise<RewardStatus[]> {
  const rewards = await loadRewards(locale);
  if (!wallet) {
    return rewards.map((reward) => ({
      ...reward,
      eligible: false,
      couponCode: null,
      progress: null,
    }));
  }

  const claims = await db().listRewardClaims(wallet);
  const claimed = new Map(claims.map((claim) => [claim.rewardSlug, claim.couponCode]));

  return Promise.all(
    rewards.map(async (reward) => {
      const couponCode = claimed.get(reward.slug) ?? null;
      const [eligible, progress] = await Promise.all([
        couponCode ? Promise.resolve(true) : meetsRequirement(wallet, reward.requirement),
        requirementProgress(wallet, reward.requirement),
      ]);
      return { ...reward, eligible, couponCode, progress };
    }),
  );
}

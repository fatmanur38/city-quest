import { readCredentials, readPasses, type OnChainCredential, type OnChainPass } from "@/lib/chain/reads";
import { CREDENTIALS, type CredentialName } from "@/lib/credentials";
import { db } from "@/server/db";
import type { Completion, Profile } from "@/server/db/types";
import type { Localized } from "@/lib/i18n/types";
import { ACTIVITIES, QUESTS, REWARDS, activityBySlug, type CatalogQuest } from "@/server/catalog";
import { resolveInstitutions, type ResolvedInstitution } from "@/server/institutions";

/**
 * Assembles the City Account screen.
 *
 * This is the one place where the two halves of the system are stitched together: verified
 * achievements come from the chain, everything playful -- points, levels, streaks, quest
 * progress -- comes from Postgres. The UI is then free to show the difference honestly.
 */

const XP_PER_LEVEL = 250;

export interface LevelInfo {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
}

export function levelFor(xp: number): LevelInfo {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  return {
    level,
    xp,
    xpIntoLevel,
    xpForNextLevel: XP_PER_LEVEL,
    progress: xpIntoLevel / XP_PER_LEVEL,
  };
}

export interface CredentialView extends OnChainCredential {
  issuerName: Localized;
  issuerEmoji: string;
}

export interface RequirementProgress {
  label: Localized;
  met: boolean;
  /** Whether this requirement is proven on-chain or scored by our own app. */
  verifiedOnChain: boolean;
}

export interface QuestProgress {
  quest: CatalogQuest;
  requirements: RequirementProgress[];
  completed: number;
  total: number;
  allMet: boolean;
  /** True once the reward credential is actually held. */
  claimed: boolean;
}

export interface RewardView {
  slug: string;
  sponsorName: string;
  title: Localized;
  description: Localized;
  emoji: string;
  requiredCredentialTitle: Localized;
  eligible: boolean;
  couponCode: string | null;
}

export interface AccountView {
  wallet: `0x${string}`;
  profile: Profile;
  level: LevelInfo;
  credentials: CredentialView[];
  passes: OnChainPass[];
  completions: Completion[];
  quests: QuestProgress[];
  rewards: RewardView[];
  libraryStreakDays: number;
  institutions: ResolvedInstitution[];
}

function decorateCredentials(
  credentials: OnChainCredential[],
  byAddress: Map<string, ResolvedInstitution>,
): CredentialView[] {
  return credentials.map((credential) => {
    const institution = byAddress.get(credential.issuer.toLowerCase());
    return {
      ...credential,
      issuerName: institution?.label ?? { en: "Unknown institution", tr: "Bilinmeyen kurum" },
      issuerEmoji: institution?.emoji ?? "🏢",
    };
  });
}

/** Consecutive days, counting back from today, with at least one library visit. */
export function libraryStreak(completions: Completion[], today = new Date()): number {
  const days = new Set(
    completions
      .filter((completion) => activityBySlug(completion.activitySlug)?.cadence === "daily")
      .map((completion) => completion.periodKey),
  );

  let streak = 0;
  const cursor = new Date(today);
  // Yesterday still counts while today is not yet visited, so a streak is not lost at midnight.
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function questProgress(
  quest: CatalogQuest,
  heldCredentials: Set<string>,
  completions: Completion[],
): QuestProgress {
  const requirements: RequirementProgress[] = quest.requirements.map((requirement) => {
    if (requirement.kind === "credential") {
      return {
        label: requirement.label,
        met: heldCredentials.has(CREDENTIALS[requirement.credential].hash.toLowerCase()),
        verifiedOnChain: true,
      };
    }
    return {
      label: requirement.label,
      met: completions.some((c) => c.activitySlug === requirement.activitySlug),
      verifiedOnChain: false,
    };
  });

  const completed = requirements.filter((r) => r.met).length;
  return {
    quest,
    requirements,
    completed,
    total: requirements.length,
    allMet: completed === requirements.length,
    claimed: heldCredentials.has(CREDENTIALS[quest.rewardCredential].hash.toLowerCase()),
  };
}

export async function loadAccount(wallet: `0x${string}`): Promise<AccountView> {
  const database = db();
  const [profile, credentials, passes, completions, rewardClaims, { list, byAddress }] =
    await Promise.all([
      database.upsertProfile(wallet),
      readCredentials(wallet),
      readPasses(wallet),
      database.listCompletions(wallet),
      database.listRewardClaims(wallet),
      resolveInstitutions(),
    ]);

  const heldCredentials = new Set(
    credentials.filter((c) => !c.revoked).map((c) => c.hash.toLowerCase()),
  );

  const rewards: RewardView[] = REWARDS.map((reward) => {
    const claim = rewardClaims.find((c) => c.rewardSlug === reward.slug);
    return {
      slug: reward.slug,
      sponsorName: reward.sponsorName,
      title: reward.title,
      description: reward.description,
      emoji: reward.emoji,
      requiredCredentialTitle: CREDENTIALS[reward.requiredCredential].title,
      eligible: heldCredentials.has(CREDENTIALS[reward.requiredCredential].hash.toLowerCase()),
      couponCode: claim?.couponCode ?? null,
    };
  });

  return {
    wallet,
    profile,
    level: levelFor(profile.xp),
    credentials: decorateCredentials(credentials, byAddress),
    passes,
    completions,
    quests: QUESTS.map((quest) => questProgress(quest, heldCredentials, completions)),
    rewards,
    libraryStreakDays: libraryStreak(completions),
    institutions: list,
  };
}

/** Which achievements a citizen holds, for the quest and reward checks. */
export async function heldCredentialNames(wallet: `0x${string}`): Promise<Set<CredentialName>> {
  const credentials = await readCredentials(wallet);
  const held = new Set<CredentialName>();
  for (const credential of credentials) {
    if (!credential.revoked && credential.definition.name in CREDENTIALS) {
      held.add(credential.definition.name);
    }
  }
  return held;
}

export { ACTIVITIES };

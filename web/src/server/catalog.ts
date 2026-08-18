import type { CredentialName } from "@/lib/credentials";
import type { InstitutionTypeName } from "@/lib/chain/contracts";

/**
 * The city's catalogue: which institutions exist, what you can do at them, which quests are
 * running, what sponsors offer.
 *
 * This is static content, so it lives in code rather than in the database. In production a city
 * would edit it through a CMS or an admin table; nothing about the architecture changes if it
 * moves, because everything reads it through the helpers at the bottom of this file.
 *
 * Note what is NOT here: anything about a person. User state lives in the database, and the
 * proof that an institution vouched for someone lives on-chain.
 */

/** Which server-side key signs on this institution's behalf. */
export type SignerRole = "library" | "scienceCenter" | "municipality";

export interface CatalogInstitution {
  slug: string;
  name: string;
  kind: InstitutionTypeName;
  /** Shown to citizens, never sent on-chain. */
  description: string;
  district: string;
  emoji: string;
  /** Absent for sponsors, which never issue achievements. */
  signerRole?: SignerRole;
  isIssuer: boolean;
}

export type ActivityKind = "checkin" | "ticket" | "workshop" | "quiz";

export interface CatalogActivity {
  slug: string;
  institutionSlug: string;
  title: string;
  summary: string;
  description: string;
  kind: ActivityKind;
  /** Achievement awarded on completion. Quizzes award XP only. */
  credential: CredentialName | null;
  xpReward: number;
  /** "daily" activities may be verified once per calendar day, "once" a single time ever. */
  cadence: "daily" | "once";
  /** Price in Turkish lira, charged through ordinary payment rails. Never on-chain. */
  priceTry?: number;
  emoji: string;
  accent: "sky" | "amber" | "violet" | "emerald";
}

export type QuestRequirement =
  | { kind: "credential"; credential: CredentialName; label: string }
  | { kind: "activity"; activitySlug: string; label: string };

export interface CatalogQuest {
  slug: string;
  title: string;
  description: string;
  requirements: QuestRequirement[];
  xpReward: number;
  rewardCredential: CredentialName;
  /** Institution that vouches for the combined achievement. */
  issuerSlug: string;
  emoji: string;
}

export interface CatalogReward {
  slug: string;
  sponsorName: string;
  title: string;
  description: string;
  requiredCredential: CredentialName;
  emoji: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  /** Server-side only. Never serialise this to the browser. */
  correctIndex: number;
}

export const INSTITUTIONS: CatalogInstitution[] = [
  {
    slug: "selcuklu-library",
    name: "Selcuklu Library",
    kind: "Library",
    description:
      "A neighbourhood library with a large children's reading room and free study spaces.",
    district: "Selcuklu",
    emoji: "📚",
    signerRole: "library",
    isIssuer: true,
  },
  {
    slug: "konya-science-center",
    name: "Konya Science Center",
    kind: "ScienceCenter",
    description:
      "Hands-on exhibits, a planetarium and the earthquake simulation hall.",
    district: "Selcuklu",
    emoji: "🔬",
    signerRole: "scienceCenter",
    isIssuer: true,
  },
  {
    slug: "konya-municipality",
    name: "Konya Municipality",
    kind: "Municipality",
    description: "Runs city-wide workshops, quests and youth programmes.",
    district: "City wide",
    emoji: "🏛️",
    signerRole: "municipality",
    isIssuer: true,
  },
  {
    slug: "demo-cafe",
    name: "Demo Cafe",
    kind: "Other",
    description: "A local cafe that rewards students for verified learning.",
    district: "Selcuklu",
    emoji: "☕",
    isIssuer: false,
  },
];

export const ACTIVITIES: CatalogActivity[] = [
  {
    slug: "library-daily-visit",
    institutionSlug: "selcuklu-library",
    title: "Daily Library Visit",
    summary: "Spend time reading and get your visit confirmed at the desk.",
    description:
      "Show your passport code at the front desk. A librarian confirms your visit and your passport records it. You can earn this once per day.",
    kind: "checkin",
    credential: "LIBRARY_VISIT",
    xpReward: 10,
    cadence: "daily",
    emoji: "📚",
    accent: "amber",
  },
  {
    slug: "earthquake-simulation",
    institutionSlug: "konya-science-center",
    title: "Earthquake Experience",
    summary: "Feel a simulated earthquake and learn exactly what to do.",
    description:
      "A 20 minute guided session in the simulation hall. Book a ticket, then show it at the entrance. Your ticket is used once and cannot be reused.",
    kind: "ticket",
    credential: "EARTHQUAKE_EXPERIENCE",
    xpReward: 30,
    cadence: "once",
    priceTry: 50,
    emoji: "🌍",
    accent: "violet",
  },
  {
    slug: "robotics-workshop",
    institutionSlug: "konya-municipality",
    title: "Robotics Workshop",
    summary: "Build and program your first robot in a weekend workshop.",
    description:
      "A municipality-run workshop for ages 10 to 16. The instructor confirms your attendance at the end of the session.",
    kind: "workshop",
    credential: "ROBOTICS_WORKSHOP",
    xpReward: 50,
    cadence: "once",
    emoji: "🤖",
    accent: "sky",
  },
  {
    slug: "science-quiz",
    institutionSlug: "konya-municipality",
    title: "Science Quiz",
    summary: "Four questions about what you saw around the city.",
    description:
      "A short quiz you can take from home. This one is scored by the city app itself, so it earns experience points but no institutional achievement.",
    kind: "quiz",
    credential: null,
    xpReward: 20,
    cadence: "once",
    emoji: "🧠",
    accent: "emerald",
  },
];

export const QUESTS: CatalogQuest[] = [
  {
    slug: "science-quest",
    title: "Science Quest",
    description:
      "Visit a library, live through an earthquake safely, and prove what you learned. Three independent institutions, one achievement.",
    requirements: [
      { kind: "credential", credential: "LIBRARY_VISIT", label: "Visit a library" },
      {
        kind: "credential",
        credential: "EARTHQUAKE_EXPERIENCE",
        label: "Complete the Earthquake Experience",
      },
      { kind: "activity", activitySlug: "science-quiz", label: "Pass the science quiz" },
    ],
    xpReward: 150,
    rewardCredential: "YOUNG_SCIENTIST",
    issuerSlug: "konya-municipality",
    emoji: "🏆",
  },
];

export const REWARDS: CatalogReward[] = [
  {
    slug: "free-coffee",
    sponsorName: "Demo Cafe",
    title: "Free Hot Chocolate",
    description:
      "Show this coupon at the counter. One per person. The cafe is rewarding verified learning, not selling anything.",
    requiredCredential: "YOUNG_SCIENTIST",
    emoji: "☕",
  },
];

export const QUIZ_QUESTIONS: Record<string, QuizQuestion[]> = {
  "science-quiz": [
    {
      id: "q1",
      question: "During an earthquake indoors, what should you do first?",
      options: [
        "Run outside immediately",
        "Drop, cover and hold on",
        "Stand in a doorway",
        "Use the lift to get out",
      ],
      correctIndex: 1,
    },
    {
      id: "q2",
      question: "What instrument records the strength of an earthquake?",
      options: ["Barometer", "Seismograph", "Thermometer", "Anemometer"],
      correctIndex: 1,
    },
    {
      id: "q3",
      question: "Which layer of the Earth do tectonic plates sit on?",
      options: ["The crust", "The inner core", "The stratosphere", "The mantle"],
      correctIndex: 3,
    },
    {
      id: "q4",
      question: "Why do libraries keep older books in cooler rooms?",
      options: [
        "Cold makes ink darker",
        "Heat and humidity speed up paper decay",
        "It saves electricity",
        "Readers prefer the cold",
      ],
      correctIndex: 1,
    },
  ],
};

export const QUIZ_PASS_MARK = 0.75;

// ---------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------

export function institutionBySlug(slug: string): CatalogInstitution | undefined {
  return INSTITUTIONS.find((institution) => institution.slug === slug);
}

export function activityBySlug(slug: string): CatalogActivity | undefined {
  return ACTIVITIES.find((activity) => activity.slug === slug);
}

export function activitiesForInstitution(slug: string): CatalogActivity[] {
  return ACTIVITIES.filter((activity) => activity.institutionSlug === slug);
}

export function questBySlug(slug: string): CatalogQuest | undefined {
  return QUESTS.find((quest) => quest.slug === slug);
}

export function rewardBySlug(slug: string): CatalogReward | undefined {
  return REWARDS.find((reward) => reward.slug === slug);
}

export function issuingInstitutions(): CatalogInstitution[] {
  return INSTITUTIONS.filter((institution) => institution.isIssuer);
}

/** Institutions a demo operator can act as, keyed by the signing key they use. */
export function institutionBySignerRole(role: SignerRole): CatalogInstitution | undefined {
  return INSTITUTIONS.find((institution) => institution.signerRole === role);
}

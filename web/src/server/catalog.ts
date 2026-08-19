import type { CredentialName } from "@/lib/credentials";
import type { InstitutionTypeName } from "@/lib/chain/contracts";
import type { Localized } from "@/lib/i18n/types";
import type { IconName } from "@/lib/icons";

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
  /**
   * The canonical name, matching what is registered on-chain. Not translated: the registry entry
   * is a single public fact about a legal entity, and changing it per reader would break the
   * match between chain and catalogue.
   */
  name: string;
  /** What a reader sees. Free to differ from the registry name, and to be translated. */
  label: Localized;
  kind: InstitutionTypeName;
  description: Localized;
  district: Localized;
  icon: IconName;
  /** Absent for sponsors, which never issue achievements. */
  signerRole?: SignerRole;
  isIssuer: boolean;
}

export type ActivityKind = "checkin" | "ticket" | "workshop" | "quiz";

export interface CatalogActivity {
  slug: string;
  institutionSlug: string;
  title: Localized;
  summary: Localized;
  description: Localized;
  kind: ActivityKind;
  /** Achievement awarded on completion. Quizzes award XP only. */
  credential: CredentialName | null;
  xpReward: number;
  /** "daily" activities may be verified once per calendar day, "once" a single time ever. */
  cadence: "daily" | "once";
  /** Price in Turkish lira, charged through ordinary payment rails. Never on-chain. */
  priceTry?: number;
  icon: IconName;
  accent: "sky" | "amber" | "violet" | "emerald";
}

export type QuestRequirement =
  | { kind: "credential"; credential: CredentialName; label: Localized }
  | { kind: "activity"; activitySlug: string; label: Localized };

export interface CatalogQuest {
  slug: string;
  title: Localized;
  description: Localized;
  requirements: QuestRequirement[];
  xpReward: number;
  rewardCredential: CredentialName;
  /** Institution that vouches for the combined achievement. */
  issuerSlug: string;
  icon: IconName;
}

export interface CatalogReward {
  slug: string;
  sponsorName: string;
  title: Localized;
  description: Localized;
  requiredCredential: CredentialName;
  icon: IconName;
}

export interface QuizQuestion {
  id: string;
  question: Localized;
  options: Localized[];
  /** Server-side only. Never serialise this to the browser. */
  correctIndex: number;
}

export const INSTITUTIONS: CatalogInstitution[] = [
  {
    slug: "melikgazi-library",
    name: "Melikgazi Library",
    label: { en: "Melikgazi Library", tr: "Melikgazi Kütüphanesi" },
    kind: "Library",
    description: {
      en: "A neighbourhood library with a large children's reading room and free study spaces.",
      tr: "Geniş bir çocuk okuma salonu ve ücretsiz çalışma alanları olan bir mahalle kütüphanesi.",
    },
    district: { en: "Melikgazi", tr: "Melikgazi" },
    icon: "library",
    signerRole: "library",
    isIssuer: true,
  },
  {
    slug: "kayseri-science-center",
    name: "Kayseri Science Center",
    label: { en: "Kayseri Science Center", tr: "Kayseri Bilim Merkezi" },
    kind: "ScienceCenter",
    description: {
      en: "Hands-on exhibits, a planetarium and the earthquake simulation hall.",
      tr: "Dokunmatik sergiler, bir planetaryum ve deprem simülasyon salonu.",
    },
    district: { en: "Melikgazi", tr: "Melikgazi" },
    icon: "microscope",
    signerRole: "scienceCenter",
    isIssuer: true,
  },
  {
    slug: "kayseri-municipality",
    name: "Kayseri Municipality",
    label: { en: "Kayseri Municipality", tr: "Kayseri Büyükşehir Belediyesi" },
    kind: "Municipality",
    description: {
      en: "Runs city-wide workshops, quests and youth programmes.",
      tr: "Şehir genelinde atölyeler, görevler ve gençlik programları düzenler.",
    },
    district: { en: "City wide", tr: "Şehir geneli" },
    icon: "landmark",
    signerRole: "municipality",
    isIssuer: true,
  },
  {
    slug: "demo-cafe",
    name: "Demo Cafe",
    label: { en: "Demo Cafe", tr: "Demo Kafe" },
    kind: "Other",
    description: {
      en: "A local cafe that rewards students for verified learning.",
      tr: "Onaylanmış öğrenmeyi ödüllendiren yerel bir kafe.",
    },
    district: { en: "Melikgazi", tr: "Melikgazi" },
    icon: "coffee",
    isIssuer: false,
  },
];

export const ACTIVITIES: CatalogActivity[] = [
  {
    slug: "library-daily-visit",
    institutionSlug: "melikgazi-library",
    title: { en: "Daily Library Visit", tr: "Günlük Kütüphane Ziyareti" },
    summary: {
      en: "Spend time reading and get your visit confirmed at the desk.",
      tr: "Okuyarak vakit geçir ve ziyaretini danışmada onaylat.",
    },
    description: {
      en: "Show your account code at the front desk. A librarian confirms your visit and your account records it. You can earn this once per day.",
      tr: "Hesap kodunu danışmada göster. Bir kütüphaneci ziyaretini onaylar ve hesabın bunu kaydeder. Bunu günde bir kez kazanabilirsin.",
    },
    kind: "checkin",
    credential: "LIBRARY_VISIT",
    xpReward: 10,
    cadence: "daily",
    icon: "library",
    accent: "amber",
  },
  {
    slug: "earthquake-simulation",
    institutionSlug: "kayseri-science-center",
    title: { en: "Earthquake Experience", tr: "Deprem Deneyimi" },
    summary: {
      en: "Feel a simulated earthquake and learn exactly what to do.",
      tr: "Simüle edilmiş bir depremi hisset ve tam olarak ne yapman gerektiğini öğren.",
    },
    description: {
      en: "A 20 minute guided session in the simulation hall. Book a ticket, then show it at the entrance. Your ticket is used once and cannot be reused.",
      tr: "Simülasyon salonunda 20 dakikalık rehberli bir oturum. Bilet al, sonra girişte göster. Biletin bir kez kullanılır ve tekrar kullanılamaz.",
    },
    kind: "ticket",
    credential: "EARTHQUAKE_EXPERIENCE",
    xpReward: 30,
    cadence: "once",
    priceTry: 50,
    icon: "waves",
    accent: "violet",
  },
  {
    slug: "robotics-workshop",
    institutionSlug: "kayseri-municipality",
    title: { en: "Robotics Workshop", tr: "Robotik Atölyesi" },
    summary: {
      en: "Build and program your first robot in a weekend workshop.",
      tr: "Hafta sonu atölyesinde ilk robotunu yap ve programla.",
    },
    description: {
      en: "A municipality-run workshop for ages 10 to 16. The instructor confirms your attendance at the end of the session.",
      tr: "Belediyenin düzenlediği, 10-16 yaş arası için bir atölye. Eğitmen, oturumun sonunda katılımını onaylar.",
    },
    kind: "workshop",
    credential: "ROBOTICS_WORKSHOP",
    xpReward: 50,
    cadence: "once",
    icon: "robot",
    accent: "sky",
  },
  {
    slug: "science-quiz",
    institutionSlug: "kayseri-municipality",
    title: { en: "Science Quiz", tr: "Bilim Testi" },
    summary: {
      en: "Four questions about what you saw around the city.",
      tr: "Şehirde gördüklerin hakkında dört soru.",
    },
    description: {
      en: "A short quiz you can take from home. This one is scored by the city app itself, so it earns experience points but no institutional achievement.",
      tr: "Evden çözebileceğin kısa bir test. Bunu şehir uygulamasının kendisi değerlendirir; bu yüzden deneyim puanı kazandırır ama kurum onaylı bir başarım vermez.",
    },
    kind: "quiz",
    credential: null,
    xpReward: 20,
    cadence: "once",
    icon: "brain",
    accent: "emerald",
  },
];

export const QUESTS: CatalogQuest[] = [
  {
    slug: "science-quest",
    title: { en: "Science Quest", tr: "Bilim Görevi" },
    description: {
      en: "Visit a library, live through an earthquake safely, and prove what you learned. Three independent institutions, one achievement.",
      tr: "Bir kütüphaneyi ziyaret et, bir depremi güvenle yaşa ve öğrendiklerini kanıtla. Birbirinden bağımsız üç kurum, tek bir başarım.",
    },
    requirements: [
      {
        kind: "credential",
        credential: "LIBRARY_VISIT",
        label: { en: "Visit a library", tr: "Bir kütüphaneyi ziyaret et" },
      },
      {
        kind: "credential",
        credential: "EARTHQUAKE_EXPERIENCE",
        label: {
          en: "Complete the Earthquake Experience",
          tr: "Deprem Deneyimi'ni tamamla",
        },
      },
      {
        kind: "activity",
        activitySlug: "science-quiz",
        label: { en: "Pass the science quiz", tr: "Bilim testini geç" },
      },
    ],
    xpReward: 150,
    rewardCredential: "YOUNG_SCIENTIST",
    issuerSlug: "kayseri-municipality",
    icon: "trophy",
  },
];

export const REWARDS: CatalogReward[] = [
  {
    slug: "free-coffee",
    sponsorName: "Demo Cafe",
    title: { en: "Free Hot Chocolate", tr: "Ücretsiz Sıcak Çikolata" },
    description: {
      en: "Show this coupon at the counter. One per person. The cafe is rewarding verified learning, not selling anything.",
      tr: "Bu kuponu kasada göster. Kişi başı bir adet. Kafe bir şey satmıyor, onaylanmış öğrenmeyi ödüllendiriyor.",
    },
    requiredCredential: "YOUNG_SCIENTIST",
    icon: "coffee",
  },
];

export const QUIZ_QUESTIONS: Record<string, QuizQuestion[]> = {
  "science-quiz": [
    {
      id: "q1",
      question: {
        en: "During an earthquake indoors, what should you do first?",
        tr: "Bina içindeyken deprem olduğunda ilk ne yapmalısın?",
      },
      options: [
        { en: "Run outside immediately", tr: "Hemen dışarı koş" },
        { en: "Drop, cover and hold on", tr: "Çök, kapan ve tutun" },
        { en: "Stand in a doorway", tr: "Kapı eşiğinde dur" },
        { en: "Use the lift to get out", tr: "Çıkmak için asansörü kullan" },
      ],
      correctIndex: 1,
    },
    {
      id: "q2",
      question: {
        en: "What instrument records the strength of an earthquake?",
        tr: "Bir depremin şiddetini hangi alet kaydeder?",
      },
      options: [
        { en: "Barometer", tr: "Barometre" },
        { en: "Seismograph", tr: "Sismograf" },
        { en: "Thermometer", tr: "Termometre" },
        { en: "Anemometer", tr: "Anemometre" },
      ],
      correctIndex: 1,
    },
    {
      id: "q3",
      question: {
        en: "Which layer of the Earth do tectonic plates sit on?",
        tr: "Tektonik levhalar Dünya'nın hangi katmanının üzerinde durur?",
      },
      options: [
        { en: "The crust", tr: "Yer kabuğu" },
        { en: "The inner core", tr: "İç çekirdek" },
        { en: "The stratosphere", tr: "Stratosfer" },
        { en: "The mantle", tr: "Manto" },
      ],
      correctIndex: 3,
    },
    {
      id: "q4",
      question: {
        en: "Why do libraries keep older books in cooler rooms?",
        tr: "Kütüphaneler eski kitapları neden daha serin odalarda tutar?",
      },
      options: [
        { en: "Cold makes ink darker", tr: "Soğuk mürekkebi koyulaştırır" },
        {
          en: "Heat and humidity speed up paper decay",
          tr: "Sıcaklık ve nem kâğıdın bozulmasını hızlandırır",
        },
        { en: "It saves electricity", tr: "Elektrikten tasarruf sağlar" },
        { en: "Readers prefer the cold", tr: "Okuyucular soğuğu tercih eder" },
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

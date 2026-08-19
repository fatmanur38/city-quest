import { keccak256, toBytes } from "viem";
import type { Localized } from "./i18n/types";
import type { IconName } from "./icons";

/**
 * The achievement catalogue.
 *
 * Only `keccak256(name)` ever reaches the blockchain. Everything a person actually sees -- the
 * title, the icon, the wording -- lives here, so a city can restyle its badges, or add a
 * language, without touching a deployed contract.
 */

export const CREDENTIAL_NAMES = [
  "LIBRARY_VISIT",
  "SCIENCE_CENTER_VISIT",
  "EARTHQUAKE_EXPERIENCE",
  "ROBOTICS_WORKSHOP",
  "MUSEUM_EXPLORER",
  "SCIENCE_EXPLORER",
  "YOUNG_SCIENTIST",
] as const;

export type CredentialName = (typeof CREDENTIAL_NAMES)[number];

export interface CredentialDefinition {
  name: CredentialName;
  /** keccak256 of the name -- the only form the contract knows. */
  hash: `0x${string}`;
  title: Localized;
  icon: IconName;
  description: Localized;
  /** Higher tier badges are earned by combining others. */
  tier: "activity" | "milestone";
}

function define(
  name: CredentialName,
  title: Localized,
  icon: IconName,
  description: Localized,
  tier: CredentialDefinition["tier"] = "activity",
): CredentialDefinition {
  return { name, hash: keccak256(toBytes(name)), title, icon, description, tier };
}

export const CREDENTIALS: Record<CredentialName, CredentialDefinition> = {
  LIBRARY_VISIT: define(
    "LIBRARY_VISIT",
    { en: "Library Visitor", tr: "Kütüphane Ziyaretçisi" },
    "book",
    {
      en: "Checked in at a city library and spent time reading.",
      tr: "Bir şehir kütüphanesine uğradı ve okuyarak vakit geçirdi.",
    },
  ),
  SCIENCE_CENTER_VISIT: define(
    "SCIENCE_CENTER_VISIT",
    { en: "Science Center Visitor", tr: "Bilim Merkezi Ziyaretçisi" },
    "microscope",
    {
      en: "Explored the exhibits at a city science center.",
      tr: "Şehrin bilim merkezindeki sergileri gezdi.",
    },
  ),
  EARTHQUAKE_EXPERIENCE: define(
    "EARTHQUAKE_EXPERIENCE",
    { en: "Earthquake Experience", tr: "Deprem Deneyimi" },
    "waves",
    {
      en: "Completed the earthquake simulation and learned what to do when the ground moves.",
      tr: "Deprem simülasyonunu tamamladı ve yer sarsıldığında ne yapılacağını öğrendi.",
    },
  ),
  ROBOTICS_WORKSHOP: define(
    "ROBOTICS_WORKSHOP",
    { en: "Robotics Workshop", tr: "Robotik Atölyesi" },
    "robot",
    {
      en: "Built and programmed a robot in a municipality workshop.",
      tr: "Belediye atölyesinde bir robot yaptı ve programladı.",
    },
  ),
  MUSEUM_EXPLORER: define(
    "MUSEUM_EXPLORER",
    { en: "Museum Explorer", tr: "Müze Kâşifi" },
    "landmark",
    { en: "Visited a city museum.", tr: "Bir şehir müzesini ziyaret etti." },
  ),
  SCIENCE_EXPLORER: define(
    "SCIENCE_EXPLORER",
    { en: "Science Explorer", tr: "Bilim Kâşifi" },
    "flask",
    {
      en: "Completed a series of science activities across the city.",
      tr: "Şehrin dört bir yanında bir dizi bilim etkinliğini tamamladı.",
    },
    "milestone",
  ),
  YOUNG_SCIENTIST: define(
    "YOUNG_SCIENTIST",
    { en: "Young Scientist", tr: "Genç Bilim İnsanı" },
    "trophy",
    {
      en: "Earned by combining verified achievements from several independent institutions.",
      tr: "Birbirinden bağımsız birkaç kurumun onayladığı başarımları birleştirerek kazanıldı.",
    },
    "milestone",
  ),
};

export const CREDENTIAL_LIST: CredentialDefinition[] = CREDENTIAL_NAMES.map((n) => CREDENTIALS[n]);

const BY_HASH = new Map<string, CredentialDefinition>(
  CREDENTIAL_LIST.map((definition) => [definition.hash.toLowerCase(), definition]),
);

export function credentialByHash(hash: string): CredentialDefinition | undefined {
  return BY_HASH.get(hash.toLowerCase());
}

export function credentialHash(name: CredentialName): `0x${string}` {
  return CREDENTIALS[name].hash;
}

export function isCredentialName(value: string): value is CredentialName {
  return (CREDENTIAL_NAMES as readonly string[]).includes(value);
}

/**
 * Describes an unknown achievement gracefully. Another city could issue a credential this
 * deployment has never heard of -- that is the entire point of a shared registry -- so the UI
 * must render it rather than crash.
 */
export function describeCredential(hash: string): CredentialDefinition {
  return (
    credentialByHash(hash) ?? {
      name: "UNKNOWN" as CredentialName,
      hash: hash as `0x${string}`,
      title: { en: "Achievement", tr: "Başarım" },
      icon: "medal",
      description: {
        en: "Issued by an institution outside this city's catalogue.",
        tr: "Bu şehrin kataloğu dışındaki bir kurum tarafından verildi.",
      },
      tier: "activity",
    }
  );
}

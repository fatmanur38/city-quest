import { publicEnv } from "@/lib/env";
import { cityPassportAbi, experiencePassAbi, institutionRegistryAbi } from "./abis";

export const contracts = {
  registry: {
    address: publicEnv.institutionRegistry,
    abi: institutionRegistryAbi,
  },
  passport: {
    address: publicEnv.cityPassport,
    abi: cityPassportAbi,
  },
  experiencePass: {
    address: publicEnv.experiencePass,
    abi: experiencePassAbi,
  },
} as const;

/** Mirrors InstitutionRegistry.InstitutionType. */
export const INSTITUTION_TYPES = [
  "Library",
  "ScienceCenter",
  "Museum",
  "University",
  "Municipality",
  "Other",
] as const;

export type InstitutionTypeName = (typeof INSTITUTION_TYPES)[number];

export function institutionTypeName(index: number): InstitutionTypeName {
  return INSTITUTION_TYPES[index] ?? "Other";
}

export function institutionTypeIndex(name: InstitutionTypeName): number {
  return INSTITUTION_TYPES.indexOf(name);
}

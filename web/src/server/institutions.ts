import { readInstitutions, type OnChainInstitution } from "@/lib/chain/reads";
import { INSTITUTIONS, type CatalogInstitution } from "@/server/catalog";
import type { Localized } from "@/lib/i18n/types";

/**
 * Institution identity, assembled from two sources on purpose.
 *
 * The name, the type and whether it is currently allowed to issue anything come from the
 * registry contract -- that is the part another city, another app or an auditor can read
 * without asking us. The emoji, the description and the district come from our catalogue,
 * because presentation is ours to change and nobody else needs to verify it.
 */

export interface ResolvedInstitution {
  address: `0x${string}` | null;
  /** The registry name — one public fact about a legal entity, so not translated. */
  name: string;
  /** What a reader sees. Falls back to the registry name for institutions we do not know. */
  label: Localized;
  kind: string;
  active: boolean;
  onChain: boolean;
  catalog: CatalogInstitution | null;
  emoji: string;
  description: Localized;
  district: Localized;
}

function fromCatalog(entry: CatalogInstitution, chain?: OnChainInstitution): ResolvedInstitution {
  return {
    address: chain?.address ?? null,
    name: chain?.name ?? entry.name,
    label: entry.label,
    kind: chain?.kind ?? entry.kind,
    active: chain?.active ?? false,
    onChain: Boolean(chain),
    catalog: entry,
    emoji: entry.emoji,
    description: entry.description,
    district: entry.district,
  };
}

/** Everything the city knows about its institutions, keyed for lookup by address. */
export async function resolveInstitutions(): Promise<{
  list: ResolvedInstitution[];
  byAddress: Map<string, ResolvedInstitution>;
  bySlug: Map<string, ResolvedInstitution>;
}> {
  const chainInstitutions = await readInstitutions();
  const byName = new Map(chainInstitutions.map((i) => [i.name.toLowerCase(), i]));

  const list: ResolvedInstitution[] = INSTITUTIONS.map((entry) =>
    fromCatalog(entry, byName.get(entry.name.toLowerCase())),
  );

  // An institution registered on-chain that this deployment has never heard of still belongs in
  // the list. Other cities can join the registry without our catalogue knowing about them.
  const knownNames = new Set(INSTITUTIONS.map((i) => i.name.toLowerCase()));
  for (const chain of chainInstitutions) {
    if (knownNames.has(chain.name.toLowerCase())) continue;
    list.push({
      address: chain.address,
      name: chain.name,
      label: { en: chain.name, tr: chain.name },
      kind: chain.kind,
      active: chain.active,
      onChain: true,
      catalog: null,
      emoji: "🏢",
      description: {
        en: "Registered in the city registry outside this app's catalogue.",
        tr: "Bu uygulamanın kataloğu dışında, şehir kayıt defterinde kayıtlı.",
      },
      district: { en: "—", tr: "—" },
    });
  }

  const byAddress = new Map<string, ResolvedInstitution>();
  const bySlug = new Map<string, ResolvedInstitution>();
  for (const institution of list) {
    if (institution.address) byAddress.set(institution.address.toLowerCase(), institution);
    if (institution.catalog) bySlug.set(institution.catalog.slug, institution);
  }

  return { list, byAddress, bySlug };
}

/** The registered on-chain address for a catalogue institution, if it has one. */
export async function addressForSlug(slug: string): Promise<`0x${string}` | null> {
  const { bySlug } = await resolveInstitutions();
  return bySlug.get(slug)?.address ?? null;
}

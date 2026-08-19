import {
  Anchor,
  Atom,
  Award,
  BookOpen,
  Bot,
  Brain,
  Building2,
  Coffee,
  Compass,
  Croissant,
  Dumbbell,
  Feather,
  FlaskConical,
  Gift,
  GraduationCap,
  IceCream,
  Landmark,
  Leaf,
  Library,
  MapPin,
  Medal,
  Microscope,
  Music,
  Palette,
  Percent,
  Pizza,
  Rocket,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Theater,
  Ticket,
  TreePine,
  Trophy,
  Utensils,
  Waves,
  type LucideIcon,
} from "lucide-react";

/**
 * The icon vocabulary.
 *
 * Everything the app used to say with an emoji is named here instead. Emoji were the wrong tool
 * for this: they are rendered by the operating system, so the same achievement looked different
 * on a librarian's Windows desktop and a student's iPhone, they cannot take a colour from the
 * palette, and at the sizes this interface uses them they read as decoration rather than as
 * part of the design.
 *
 * Names are stored -- in the catalogue, and in the database for anything a business chose --
 * rather than components, so the value survives serialisation from a server component and can
 * sit in a Postgres column.
 */

export const ICONS = {
  // Achievements and activities
  book: BookOpen,
  library: Library,
  microscope: Microscope,
  atom: Atom,
  waves: Waves,
  robot: Bot,
  brain: Brain,
  flask: FlaskConical,
  trophy: Trophy,
  award: Award,
  medal: Medal,
  graduation: GraduationCap,

  // Places
  landmark: Landmark,
  building: Building2,
  store: Store,
  mapPin: MapPin,

  // Things a business might offer
  coffee: Coffee,
  croissant: Croissant,
  iceCream: IceCream,
  pizza: Pizza,
  utensils: Utensils,
  bag: ShoppingBag,
  gift: Gift,
  percent: Percent,
  tag: Tag,
  ticket: Ticket,

  // Culture and leisure
  palette: Palette,
  music: Music,
  theater: Theater,
  tree: TreePine,
  dumbbell: Dumbbell,

  // Generic
  sparkles: Sparkles,
  compass: Compass,
  rocket: Rocket,
  leaf: Leaf,
  anchor: Anchor,
  feather: Feather,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function isIconName(value: string): value is IconName {
  return value in ICONS;
}

/**
 * Never throws. A catalogue entry from another city, or a row written before an icon was
 * renamed, still has to render something rather than take the page down.
 */
export function iconFor(name: string | null | undefined): LucideIcon {
  return name && isIconName(name) ? ICONS[name] : ICONS.sparkles;
}

/** The subset a business is offered when it publishes a campaign. */
export const OFFER_ICONS: IconName[] = [
  "coffee",
  "croissant",
  "iceCream",
  "pizza",
  "utensils",
  "bag",
  "gift",
  "percent",
  "tag",
  "ticket",
  "palette",
  "music",
  "theater",
  "tree",
  "dumbbell",
  "book",
];

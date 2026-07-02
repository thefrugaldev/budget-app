import {
  Banknote,
  Beer,
  Briefcase,
  Car,
  CircleDollarSign,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandHeart,
  Home,
  Landmark,
  Lightbulb,
  LineChart,
  type LucideIcon,
  Music,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Siren,
  Smartphone,
  Stethoscope,
  TrainFront,
  TrendingUp,
  Tv,
  Umbrella,
  Utensils,
  Wifi,
} from "lucide-react";

/**
 * The app's category icon system (#80 chunk 4). Replaces free-form emoji with
 * a curated, palette-tintable lucide set so iconography reads as designed and
 * renders identically on every device.
 *
 * Deliberately no schema change (the PRD keeps the budget domain model out of
 * scope): a category still stores its `emoji` string. Each icon here carries a
 * representative `emoji`, the new picker writes that emoji, and
 * `resolveCategoryIcon` maps emoji → component at render time. Existing/seed
 * categories keep resolving through `EMOJI_ALIASES` so nothing renders blank,
 * and later chunks can route every remaining emoji render site through the same
 * resolver without touching persistence.
 */
type CategoryIconEntry = {
  /** Stable identifier for the icon (picker keys, tests). */
  key: string;
  /** Human label shown in the picker and used as the accessible name. */
  label: string;
  /** The emoji persisted in `Category.emoji` when this icon is chosen. */
  emoji: string;
  /** The lucide component rendered for it. */
  Icon: LucideIcon;
};

/**
 * The pickable set, in display order. Chosen to cover every seed category plus
 * the common budget concepts the old emoji name-hints suggested, so the picker
 * is a real replacement rather than a subset.
 */
export const CATEGORY_ICONS: readonly CategoryIconEntry[] = [
  { key: "groceries", label: "Groceries", emoji: "🛒", Icon: ShoppingCart },
  { key: "dining", label: "Dining", emoji: "🍔", Icon: Utensils },
  { key: "coffee", label: "Coffee", emoji: "☕", Icon: Coffee },
  { key: "drinks", label: "Drinks", emoji: "🍺", Icon: Beer },
  { key: "gas", label: "Gas", emoji: "⛽", Icon: Fuel },
  { key: "car", label: "Car", emoji: "🚗", Icon: Car },
  { key: "transit", label: "Transit", emoji: "🚆", Icon: TrainFront },
  { key: "travel", label: "Travel", emoji: "✈️", Icon: Plane },
  { key: "home", label: "Home", emoji: "🏠", Icon: Home },
  { key: "utilities", label: "Utilities", emoji: "💡", Icon: Lightbulb },
  { key: "phone", label: "Phone", emoji: "📱", Icon: Smartphone },
  { key: "internet", label: "Internet", emoji: "🌐", Icon: Wifi },
  { key: "entertainment", label: "Entertainment", emoji: "🎬", Icon: Clapperboard },
  { key: "subscription", label: "Subscriptions", emoji: "📺", Icon: Tv },
  { key: "music", label: "Music", emoji: "🎵", Icon: Music },
  { key: "gaming", label: "Gaming", emoji: "🎮", Icon: Gamepad2 },
  { key: "shopping", label: "Shopping", emoji: "🛍️", Icon: ShoppingBag },
  { key: "clothing", label: "Clothing", emoji: "👕", Icon: Shirt },
  { key: "gift", label: "Gifts", emoji: "🎁", Icon: Gift },
  { key: "health", label: "Health", emoji: "🩺", Icon: Stethoscope },
  { key: "pharmacy", label: "Pharmacy", emoji: "💊", Icon: Pill },
  { key: "fitness", label: "Fitness", emoji: "🏋️", Icon: Dumbbell },
  { key: "education", label: "Education", emoji: "🎓", Icon: GraduationCap },
  { key: "pets", label: "Pets", emoji: "🐾", Icon: PawPrint },
  { key: "charity", label: "Charity", emoji: "💝", Icon: HandHeart },
  { key: "emergency", label: "Emergency", emoji: "🚨", Icon: Siren },
  { key: "work", label: "Work", emoji: "💼", Icon: Briefcase },
  { key: "income", label: "Income", emoji: "💵", Icon: Banknote },
  { key: "bank", label: "Bank", emoji: "🏦", Icon: Landmark },
  { key: "investment", label: "Investments", emoji: "📈", Icon: TrendingUp },
  { key: "analytics", label: "Analytics", emoji: "📊", Icon: LineChart },
  { key: "vacation", label: "Vacation", emoji: "🏖️", Icon: Umbrella },
  { key: "savings", label: "Savings", emoji: "💰", Icon: PiggyBank },
  { key: "other", label: "Other", emoji: "🪣", Icon: CircleDollarSign },
];

/** Fallback for any emoji not covered by the registry or aliases. */
export const DEFAULT_CATEGORY_ICON: LucideIcon = CircleDollarSign;

/**
 * Extra emoji → icon-key mappings for values that don't equal a registry
 * entry's representative emoji: seed variants, old name-hint emoji, and common
 * skin/style variants. Keeps pre-existing categories from falling back to the
 * default icon.
 */
const EMOJI_ALIASES: Readonly<Record<string, string>> = {
  "🥦": "groceries",
  "🍽️": "dining",
  "🍴": "dining",
  "🍕": "dining",
  "🍜": "dining",
  "🚕": "transit",
  "🚌": "transit",
  "🚇": "transit",
  "🏡": "home",
  "💧": "utilities",
  "⚡": "utilities",
  "🎥": "entertainment",
  "🎶": "music",
  "🏨": "travel",
  "🌴": "vacation",
  "🏖": "vacation",
  "👗": "clothing",
  "👟": "clothing",
  "🍷": "drinks",
  "🍸": "drinks",
  "🐶": "pets",
  "🐱": "pets",
  "📚": "education",
  "🎉": "gift",
  "🩹": "health",
  "💵": "income",
  "💶": "income",
  "🪣": "other",
};

// emoji → Icon, built once from the registry plus the aliases.
const ICON_BY_EMOJI: ReadonlyMap<string, LucideIcon> = new Map([
  ...CATEGORY_ICONS.map((e) => [e.emoji, e.Icon] as const),
  ...Object.entries(EMOJI_ALIASES).map(
    ([emoji, key]) =>
      [
        emoji,
        CATEGORY_ICONS.find((e) => e.key === key)?.Icon ?? DEFAULT_CATEGORY_ICON,
      ] as const,
  ),
]);

/**
 * The lucide icon a category should render. Keyed off the stored `emoji` so no
 * persistence change is needed; unknown emoji fall back to a neutral money
 * glyph rather than rendering blank.
 */
export function resolveCategoryIcon(category: { emoji: string }): LucideIcon {
  return ICON_BY_EMOJI.get(category.emoji) ?? DEFAULT_CATEGORY_ICON;
}

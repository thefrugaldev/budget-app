import {
  Apple,
  Baby,
  Backpack,
  Banknote,
  BedDouble,
  Beer,
  Bike,
  Bitcoin,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  CakeSlice,
  Calendar,
  Camera,
  Candy,
  Car,
  CarFront,
  CarTaxiFront,
  Carrot,
  Cat,
  CircleDollarSign,
  Clapperboard,
  Coffee,
  Coins,
  CookingPot,
  CreditCard,
  Dog,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Fuel,
  Gamepad2,
  Gem,
  Gift,
  Glasses,
  GraduationCap,
  Guitar,
  HandCoins,
  HandHeart,
  Heart,
  Home,
  House,
  IceCreamCone,
  KeyRound,
  Landmark,
  Laptop,
  Lightbulb,
  LineChart,
  Luggage,
  type LucideIcon,
  Mail,
  Map as MapIcon,
  Milk,
  Mountain,
  Music,
  Palette,
  PawPrint,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Popcorn,
  Printer,
  Receipt,
  Sandwich,
  School,
  Scissors,
  Ship,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  ShieldCheck,
  Siren,
  Smartphone,
  Sofa,
  Soup,
  Sparkles,
  SprayCan,
  Sprout,
  SquareParking,
  Star,
  Stethoscope,
  Tag,
  Tent,
  Ticket,
  ToyBrick,
  TrainFront,
  TrendingUp,
  Trophy,
  Tv,
  Umbrella,
  Users,
  Utensils,
  Watch,
  Wallet,
  Wheat,
  Wifi,
  Wine,
  Wrench,
  Zap,
} from "lucide-react";

/**
 * The app's category icon system (#80 chunk 4). Replaces free-form emoji with
 * a curated, palette-tintable lucide set so iconography reads as designed and
 * renders identically on every device. lucide is a single visual family, so a
 * broad set stays coherent — the goal is one consistent language, not a tiny
 * list.
 *
 * Deliberately no schema change (the PRD keeps the budget domain model out of
 * scope): a category still stores its `emoji` string. Each icon here carries a
 * unique representative `emoji`, the picker writes that emoji, and
 * `resolveCategoryIcon` maps emoji → component at render. Existing/seed
 * categories keep resolving through the registry + `EMOJI_ALIASES` so nothing
 * renders blank, and every render site goes through the resolver.
 */
type CategoryIconEntry = {
  /** Stable identifier for the icon (picker keys, tests). */
  key: string;
  /** Human label shown in the picker and used as the accessible name. */
  label: string;
  /** The (unique) emoji persisted in `Category.emoji` when this icon is chosen. */
  emoji: string;
  /** The lucide component rendered for it. */
  Icon: LucideIcon;
};

/**
 * The pickable set, grouped by theme in display order. Covers the seed
 * categories plus a wide range of everyday budget concepts so the picker is a
 * genuine replacement for the emoji keyboard, not a subset.
 */
export const CATEGORY_ICONS: readonly CategoryIconEntry[] = [
  // Food & drink
  { key: "groceries", label: "Groceries", emoji: "🛒", Icon: ShoppingCart },
  { key: "dining", label: "Dining", emoji: "🍔", Icon: Utensils },
  { key: "pizza", label: "Pizza", emoji: "🍕", Icon: Pizza },
  { key: "sandwich", label: "Sandwich", emoji: "🥪", Icon: Sandwich },
  { key: "soup", label: "Soup", emoji: "🍜", Icon: Soup },
  { key: "dessert", label: "Dessert", emoji: "🍰", Icon: CakeSlice },
  { key: "icecream", label: "Ice cream", emoji: "🍦", Icon: IceCreamCone },
  { key: "candy", label: "Candy", emoji: "🍬", Icon: Candy },
  { key: "fruit", label: "Fruit", emoji: "🍎", Icon: Apple },
  { key: "produce", label: "Produce", emoji: "🥕", Icon: Carrot },
  { key: "cooking", label: "Cooking", emoji: "🍳", Icon: CookingPot },
  { key: "coffee", label: "Coffee", emoji: "☕", Icon: Coffee },
  { key: "drinks", label: "Drinks", emoji: "🍺", Icon: Beer },
  { key: "wine", label: "Wine", emoji: "🍷", Icon: Wine },
  { key: "milk", label: "Milk", emoji: "🥛", Icon: Milk },
  { key: "grain", label: "Grain", emoji: "🌾", Icon: Wheat },

  // Transport
  { key: "gas", label: "Gas", emoji: "⛽", Icon: Fuel },
  { key: "car", label: "Car", emoji: "🚗", Icon: Car },
  { key: "vehicle", label: "Vehicle", emoji: "🚙", Icon: CarFront },
  { key: "transit", label: "Transit", emoji: "🚆", Icon: TrainFront },
  { key: "bus", label: "Bus", emoji: "🚌", Icon: Bus },
  { key: "bike", label: "Bike", emoji: "🚲", Icon: Bike },
  { key: "taxi", label: "Taxi", emoji: "🚕", Icon: CarTaxiFront },
  { key: "plane", label: "Flights", emoji: "✈️", Icon: Plane },
  { key: "boat", label: "Boat", emoji: "🚢", Icon: Ship },
  { key: "parking", label: "Parking", emoji: "🅿️", Icon: SquareParking },

  // Home & utilities
  { key: "home", label: "Home", emoji: "🏠", Icon: Home },
  { key: "house", label: "House", emoji: "🏡", Icon: House },
  { key: "building", label: "Building", emoji: "🏢", Icon: Building2 },
  { key: "keys", label: "Rent", emoji: "🔑", Icon: KeyRound },
  { key: "utilities", label: "Utilities", emoji: "💡", Icon: Lightbulb },
  { key: "power", label: "Power", emoji: "⚡", Icon: Zap },
  { key: "water", label: "Water", emoji: "💧", Icon: Droplet },
  { key: "heating", label: "Heating", emoji: "🔥", Icon: Flame },
  { key: "internet", label: "Internet", emoji: "🌐", Icon: Wifi },
  { key: "phone", label: "Phone", emoji: "📱", Icon: Smartphone },
  { key: "repairs", label: "Repairs", emoji: "🔧", Icon: Wrench },
  { key: "furniture", label: "Furniture", emoji: "🛋️", Icon: Sofa },
  { key: "garden", label: "Garden", emoji: "🌱", Icon: Sprout },
  { key: "cleaning", label: "Cleaning", emoji: "🧴", Icon: SprayCan },

  // Shopping & personal
  { key: "shopping", label: "Shopping", emoji: "🛍️", Icon: ShoppingBag },
  { key: "clothing", label: "Clothing", emoji: "👕", Icon: Shirt },
  { key: "shoes", label: "Shoes", emoji: "👟", Icon: Footprints },
  { key: "bag", label: "Bags", emoji: "🎒", Icon: Backpack },
  { key: "jewelry", label: "Jewelry", emoji: "💍", Icon: Gem },
  { key: "watch", label: "Watch", emoji: "⌚", Icon: Watch },
  { key: "eyewear", label: "Eyewear", emoji: "👓", Icon: Glasses },
  { key: "beauty", label: "Beauty", emoji: "💄", Icon: Sparkles },
  { key: "salon", label: "Salon", emoji: "💈", Icon: Scissors },
  { key: "gift", label: "Gifts", emoji: "🎁", Icon: Gift },

  // Health & fitness
  { key: "health", label: "Health", emoji: "🩺", Icon: Stethoscope },
  { key: "pharmacy", label: "Pharmacy", emoji: "💊", Icon: Pill },
  { key: "wellness", label: "Wellness", emoji: "❤️", Icon: Heart },
  { key: "fitness", label: "Fitness", emoji: "🏋️", Icon: Dumbbell },
  { key: "sports", label: "Sports", emoji: "🏆", Icon: Trophy },

  // Entertainment & hobbies
  { key: "entertainment", label: "Entertainment", emoji: "🎬", Icon: Clapperboard },
  { key: "movies", label: "Movies", emoji: "🍿", Icon: Popcorn },
  { key: "streaming", label: "Streaming", emoji: "📺", Icon: Tv },
  { key: "music", label: "Music", emoji: "🎵", Icon: Music },
  { key: "gaming", label: "Gaming", emoji: "🎮", Icon: Gamepad2 },
  { key: "books", label: "Books", emoji: "📚", Icon: BookOpen },
  { key: "photo", label: "Photography", emoji: "📷", Icon: Camera },
  { key: "art", label: "Art", emoji: "🎨", Icon: Palette },
  { key: "events", label: "Events", emoji: "🎟️", Icon: Ticket },
  { key: "instruments", label: "Instruments", emoji: "🎸", Icon: Guitar },

  // Education & work
  { key: "education", label: "Education", emoji: "🎓", Icon: GraduationCap },
  { key: "school", label: "School", emoji: "🏫", Icon: School },
  { key: "work", label: "Work", emoji: "💼", Icon: Briefcase },
  { key: "tech", label: "Tech", emoji: "💻", Icon: Laptop },
  { key: "office", label: "Office", emoji: "🖨️", Icon: Printer },
  { key: "mail", label: "Mail", emoji: "📧", Icon: Mail },
  { key: "plans", label: "Plans", emoji: "📅", Icon: Calendar },

  // Finance
  { key: "income", label: "Income", emoji: "💵", Icon: Banknote },
  { key: "coins", label: "Coins", emoji: "🪙", Icon: Coins },
  { key: "savings", label: "Savings", emoji: "💰", Icon: PiggyBank },
  { key: "bank", label: "Bank", emoji: "🏦", Icon: Landmark },
  { key: "investment", label: "Investments", emoji: "📈", Icon: TrendingUp },
  { key: "analytics", label: "Analytics", emoji: "📊", Icon: LineChart },
  { key: "card", label: "Card", emoji: "💳", Icon: CreditCard },
  { key: "wallet", label: "Wallet", emoji: "👛", Icon: Wallet },
  { key: "cash", label: "Cash", emoji: "💸", Icon: HandCoins },
  { key: "crypto", label: "Crypto", emoji: "₿", Icon: Bitcoin },
  { key: "tax", label: "Taxes", emoji: "🧾", Icon: Receipt },
  { key: "insurance", label: "Insurance", emoji: "🛡️", Icon: ShieldCheck },
  { key: "charity", label: "Charity", emoji: "💝", Icon: HandHeart },
  { key: "emergency", label: "Emergency", emoji: "🚨", Icon: Siren },

  // Family & pets
  { key: "pets", label: "Pets", emoji: "🐾", Icon: PawPrint },
  { key: "dog", label: "Dog", emoji: "🐶", Icon: Dog },
  { key: "cat", label: "Cat", emoji: "🐱", Icon: Cat },
  { key: "baby", label: "Baby", emoji: "👶", Icon: Baby },
  { key: "toys", label: "Toys", emoji: "🧸", Icon: ToyBrick },
  { key: "family", label: "Family", emoji: "👨‍👩‍👧", Icon: Users },

  // Travel & leisure
  { key: "vacation", label: "Vacation", emoji: "🏖️", Icon: Umbrella },
  { key: "hotel", label: "Hotel", emoji: "🏨", Icon: BedDouble },
  { key: "luggage", label: "Luggage", emoji: "🧳", Icon: Luggage },
  { key: "trips", label: "Trips", emoji: "🗺️", Icon: MapIcon },
  { key: "camping", label: "Camping", emoji: "⛺", Icon: Tent },
  { key: "outdoors", label: "Outdoors", emoji: "🏔️", Icon: Mountain },

  // Misc
  { key: "favorites", label: "Favorites", emoji: "⭐", Icon: Star },
  { key: "misc", label: "Misc", emoji: "🏷️", Icon: Tag },
  { key: "other", label: "Other", emoji: "🪣", Icon: CircleDollarSign },
];

/** Fallback for any emoji not covered by the registry or aliases. */
export const DEFAULT_CATEGORY_ICON: LucideIcon = CircleDollarSign;

/**
 * Extra emoji → icon-key mappings for values that don't equal a registry
 * entry's representative emoji: seed variants, old free-picker emoji, and
 * common style variants. Keeps pre-existing categories from falling back to the
 * default icon. (Only consulted for emoji that aren't already a registry
 * representative.)
 */
const EMOJI_ALIASES: Readonly<Record<string, string>> = {
  "🥦": "produce",
  "🍽️": "dining",
  "🍴": "dining",
  "🍟": "dining",
  "🚕️": "taxi",
  "🚇": "transit",
  "🚊": "transit",
  "🏬": "shopping",
  "🏘️": "home",
  "🏚️": "home",
  "💦": "water",
  "🔌": "power",
  "🎥": "entertainment",
  "🎶": "music",
  "🎼": "music",
  "🏋️‍♀️": "fitness",
  "🏋️‍♂️": "fitness",
  "🩹": "health",
  "🩺️": "health",
  "💶": "income",
  "💴": "income",
  "💷": "income",
  "🌴": "vacation",
  "🏝️": "vacation",
  "🛒️": "groceries",
  "👗": "clothing",
  "🐕": "dog",
  "🐈": "cat",
  "🎉": "gift",
  "📖": "books",
  "🏦️": "bank",
};

// emoji → Icon, built once from the registry (representatives win) plus aliases.
const ICON_BY_EMOJI: ReadonlyMap<string, LucideIcon> = new Map([
  ...Object.entries(EMOJI_ALIASES).map(
    ([emoji, key]) =>
      [
        emoji,
        CATEGORY_ICONS.find((e) => e.key === key)?.Icon ?? DEFAULT_CATEGORY_ICON,
      ] as const,
  ),
  ...CATEGORY_ICONS.map((e) => [e.emoji, e.Icon] as const),
]);

/**
 * The lucide icon a category should render. Keyed off the stored `emoji` so no
 * persistence change is needed; unknown emoji fall back to a neutral money
 * glyph rather than rendering blank.
 */
export function resolveCategoryIcon(category: { emoji: string }): LucideIcon {
  return ICON_BY_EMOJI.get(category.emoji) ?? DEFAULT_CATEGORY_ICON;
}

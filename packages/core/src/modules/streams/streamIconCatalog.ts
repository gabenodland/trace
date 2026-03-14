/**
 * Stream icon & color catalog
 *
 * Curated set of Lucide icon names and a fixed color palette
 * for stream customization (Apple Reminders pattern).
 *
 * Colors use semantic keys (e.g. "red", "blue") stored in the DB.
 * Each theme defines its own hex values for these keys, so colors
 * adapt across light/dark/sepia/etc.
 *
 * Icons are split into free and pro tiers. Free users get a curated
 * subset (~90 icons), pro users unlock the full set (~230+ icons).
 */

// ─── Color Palette ───────────────────────────────────────────────────────────

/** Semantic color keys — stored in DB, resolved through theme at render time */
export type StreamColorKey =
  | 'red' | 'orange' | 'amber' | 'green' | 'emerald' | 'teal'
  | 'blue' | 'indigo' | 'purple' | 'pink' | 'gray' | 'brown';

export interface StreamColor {
  readonly key: StreamColorKey;
  readonly label: string;
}

/** Color options for the picker UI. DB stores the `key`, theme provides the hex. */
export const STREAM_COLORS: readonly StreamColor[] = [
  { key: 'red', label: 'Red' },
  { key: 'orange', label: 'Orange' },
  { key: 'amber', label: 'Amber' },
  { key: 'green', label: 'Green' },
  { key: 'emerald', label: 'Emerald' },
  { key: 'teal', label: 'Teal' },
  { key: 'blue', label: 'Blue' },
  { key: 'indigo', label: 'Indigo' },
  { key: 'purple', label: 'Purple' },
  { key: 'pink', label: 'Pink' },
  { key: 'gray', label: 'Gray' },
  { key: 'brown', label: 'Brown' },
] as const;

/** All valid stream color keys */
export const STREAM_COLOR_KEYS: readonly StreamColorKey[] = STREAM_COLORS.map((c) => c.key);

/**
 * Legacy hex-to-key mapping for backward compat.
 * If a stream was saved with a raw hex before the themed-color migration,
 * this maps it to the closest semantic key.
 */
const HEX_TO_KEY: Record<string, StreamColorKey> = {
  '#ef4444': 'red',
  '#f97316': 'orange',
  '#f59e0b': 'amber',
  '#22c55e': 'green',
  '#10b981': 'emerald',
  '#14b8a6': 'teal',
  '#3b82f6': 'blue',
  '#6366f1': 'indigo',
  '#8b5cf6': 'purple',
  '#ec4899': 'pink',
  '#6b7280': 'gray',
  '#92400e': 'brown',
};

/** Check if a string is a valid stream color key */
export function isValidStreamColorKey(key: string): key is StreamColorKey {
  return STREAM_COLOR_KEYS.includes(key as StreamColorKey);
}

/**
 * Resolve a stored color value to a semantic key.
 * Handles both new keys ("red") and legacy hex values ("#ef4444").
 * Returns null if unrecognized.
 */
export function resolveStreamColorKey(value: string | null | undefined): StreamColorKey | null {
  if (!value) return null;
  if (isValidStreamColorKey(value)) return value;
  // Legacy hex fallback
  const lower = value.toLowerCase();
  return HEX_TO_KEY[lower] ?? null;
}

/**
 * Resolve a raw DB color value to a display hex, using the theme's stream palette.
 * Handles keys ("red"), legacy hex ("#ef4444"), and null.
 * Returns null if the value is null/undefined or unrecognized.
 */
export function resolveStreamColorHex(
  value: string | null | undefined,
  streamPalette: Record<StreamColorKey, string>,
): string | null {
  const key = resolveStreamColorKey(value);
  if (!key) return null;
  return streamPalette[key] ?? null;
}

// ─── Icon Catalog ────────────────────────────────────────────────────────────

export interface StreamIconCategory {
  readonly label: string;
  /** Icons available to all users */
  readonly icons: readonly string[];
  /** Additional icons unlocked with pro subscription */
  readonly proIcons?: readonly string[];
}

/**
 * Curated Lucide icons grouped by category.
 * Names must match Lucide PascalCase keys (used with <Icon name="...">).
 *
 * Free tier: ~91 icons (a few from each category)
 * Pro tier: ~145 additional icons
 * Total: ~236 icons
 */
export const STREAM_ICON_CATEGORIES: readonly StreamIconCategory[] = [
  {
    label: 'Journal',
    icons: [
      'BookOpen', 'Notebook', 'PenLine', 'FileText', 'ScrollText',
      'Quote', 'Bookmark', 'StickyNote', 'Highlighter',
    ],
    proIcons: [
      'BookMarked', 'BookCopy', 'NotebookPen', 'NotebookTabs', 'Pen',
      'PenTool', 'FilePen', 'FilePlus', 'Library', 'Type',
      'Feather', 'Signature',
    ],
  },
  {
    label: 'Productivity',
    icons: [
      'CheckSquare', 'ListTodo', 'ClipboardList', 'Target', 'Flag',
      'Zap', 'Clock', 'CalendarDays', 'Inbox', 'Bell',
    ],
    proIcons: [
      'AlarmClock', 'Timer', 'TimerReset', 'CalendarCheck', 'CalendarPlus',
      'CheckCircle', 'ListChecks', 'ListOrdered', 'ClipboardCheck',
      'Kanban', 'Milestone', 'Workflow',
    ],
  },
  {
    label: 'Lifestyle',
    icons: [
      'Home', 'ShoppingBag', 'Gift', 'Users', 'Baby',
      'Dog', 'Cat', 'Shirt', 'Glasses',
    ],
    proIcons: [
      'Armchair', 'Lamp', 'Bath', 'Bed', 'Sofa',
      'Key', 'Umbrella', 'Briefcase', 'Scissors', 'Package', 'Gem',
    ],
  },
  {
    label: 'Health',
    icons: [
      'Heart', 'Activity', 'Dumbbell', 'Apple', 'Pill',
      'Brain', 'Moon', 'Sun',
    ],
    proIcons: [
      'Stethoscope', 'Thermometer', 'Syringe', 'HeartPulse', 'Salad',
      'Leaf', 'Flower', 'Bike', 'Footprints', 'PersonStanding',
      'Eye', 'Smile',
    ],
  },
  {
    label: 'Travel',
    icons: [
      'MapPin', 'Plane', 'Car', 'Train', 'Ship',
      'Compass', 'Mountain', 'Palmtree', 'Tent',
    ],
    proIcons: [
      'Globe', 'Map', 'Navigation', 'Anchor', 'Bus',
      'Truck', 'Sailboat', 'Luggage', 'Sunrise', 'Sunset', 'Landmark',
    ],
  },
  {
    label: 'Food',
    icons: [
      'Coffee', 'Wine', 'UtensilsCrossed', 'Soup', 'Pizza',
      'Cake', 'IceCream',
    ],
    proIcons: [
      'CookingPot', 'Beef', 'Egg', 'Cherry', 'Grape',
      'Citrus', 'Sandwich', 'Beer', 'Milk', 'Croissant', 'CupSoda',
    ],
  },
  {
    label: 'Creative',
    icons: [
      'Palette', 'Camera', 'Music', 'Film', 'Mic',
      'Brush', 'Pencil', 'Sparkles',
    ],
    proIcons: [
      'Clapperboard', 'Radio', 'Headphones', 'Speaker', 'Image',
      'Video', 'Aperture', 'Paintbrush', 'Wand', 'Drama',
      'Origami', 'Piano',
    ],
  },
  {
    label: 'Tech',
    icons: [
      'Code', 'Monitor', 'Smartphone', 'Wifi', 'Database',
      'Terminal', 'Bug', 'Rocket',
    ],
    proIcons: [
      'Laptop', 'Tablet', 'Server', 'Cloud', 'HardDrive',
      'Cpu', 'Signal', 'Cable', 'Usb', 'MousePointer',
      'Keyboard', 'QrCode',
    ],
  },
  {
    label: 'Finance',
    icons: [
      'DollarSign', 'CreditCard', 'Wallet', 'PiggyBank', 'TrendingUp',
      'Receipt', 'Banknote',
    ],
    proIcons: [
      'Coins', 'HandCoins', 'BadgeDollarSign', 'LineChart', 'BarChart3',
      'Calculator', 'Percent', 'Scale', 'Store', 'ShoppingCart',
    ],
  },
  {
    label: 'Nature',
    icons: [
      'TreePine', 'Sprout', 'CloudSun', 'Waves',
    ],
    proIcons: [
      'Trees', 'Clover', 'Snowflake', 'Rainbow', 'Wind',
      'Droplets', 'Flame', 'Bird', 'Fish', 'Shell',
      'Rabbit', 'Turtle',
    ],
  },
  {
    label: 'Sports & Games',
    icons: [
      'Trophy', 'Medal', 'Gamepad2', 'Swords',
    ],
    proIcons: [
      'Crown', 'Shield', 'Dice5', 'Puzzle', 'Award',
      'Goal', 'Joystick', 'ToyBrick', 'PartyPopper', 'VenetianMask',
    ],
  },
  {
    label: 'Communication',
    icons: [
      'MessageCircle', 'Mail', 'Phone', 'Send',
    ],
    proIcons: [
      'MessageSquare', 'MailOpen', 'PhoneCall', 'Megaphone', 'AtSign',
      'Share2', 'Podcast', 'Rss', 'Webhook', 'Bot',
    ],
  },
  {
    label: 'Education',
    icons: [
      'GraduationCap', 'School', 'Microscope', 'Lightbulb',
    ],
    proIcons: [
      'FlaskConical', 'TestTube', 'Ruler', 'PencilRuler', 'Presentation',
      'Languages', 'University', 'Dna', 'Orbit', 'Blocks',
    ],
  },
] as const;

/** Flat list of all free icon names */
export const ALL_STREAM_ICONS: readonly string[] = STREAM_ICON_CATEGORIES.flatMap(
  (cat) => cat.icons
);

/** Flat list of all pro-only icon names */
export const ALL_PRO_STREAM_ICONS: readonly string[] = STREAM_ICON_CATEGORIES.flatMap(
  (cat) => cat.proIcons ?? []
);

/** Combined flat list of all icon names (free + pro) */
export const ALL_ICONS_COMBINED: readonly string[] = [
  ...ALL_STREAM_ICONS,
  ...ALL_PRO_STREAM_ICONS,
];

/** Check if a string is a valid stream icon name (free or pro) */
export function isValidStreamIcon(name: string): boolean {
  return ALL_STREAM_ICONS.includes(name) || ALL_PRO_STREAM_ICONS.includes(name);
}

/** Check if an icon is pro-only */
export function isProStreamIcon(name: string): boolean {
  return ALL_PRO_STREAM_ICONS.includes(name);
}

/** @deprecated Use isValidStreamColorKey instead */
export function isValidStreamColor(hex: string): boolean {
  return isValidStreamColorKey(hex) || hex.toLowerCase() in HEX_TO_KEY;
}

/**
 * Filter icons by search query.
 * @param query Search string (case-insensitive partial match)
 * @param includePro Include pro-only icons in results (default: false)
 */
export function filterStreamIcons(query: string, includePro = false): string[] {
  const icons = includePro ? ALL_ICONS_COMBINED : ALL_STREAM_ICONS;
  if (!query.trim()) return [...icons];
  const lower = query.toLowerCase();
  return icons.filter((name) => name.toLowerCase().includes(lower));
}

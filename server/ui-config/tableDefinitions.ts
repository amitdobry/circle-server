/**
 * Table Definitions
 *
 * Defines the 6 core SoulCircle tables.
 * This is the single source of truth for which tables exist.
 *
 * Architecture:
 * - Static definitions live here (what tables exist)
 * - Runtime state lives in RoomRegistry (what's happening in each table)
 * - UI merges both to display table cards
 * - Content configuration (themeKey + subjects) lives here too
 */

export type TableSubject = {
  key: string;
  label: string;
};

export type TableContentConfig = {
  themeKey: string; // Which content theme (e.g., "philosophy")
  subjects: TableSubject[]; // Curated subject list for this table (4 subjects from global pool)
};

export type TableDefinition = {
  tableId: string;
  name: string;
  icon: string;
  description: string;
  order: number;
  content: TableContentConfig; // 🆕 Content Phase configuration
};

export const TABLE_DEFINITIONS: TableDefinition[] = [
  {
    tableId: "hearth",
    name: "The Hearth",
    icon: "🔥",
    description: "A welcoming circle for open conversation.",
    order: 1,
    content: {
      themeKey: "philosophy",
      subjects: [
        { key: "truth", label: "Truth" },
        { key: "freedom", label: "Freedom" },
        { key: "meaning", label: "Meaning" },
        { key: "beauty", label: "Beauty" },
      ],
    },
  },
  {
    tableId: "listening",
    name: "The Listening Room",
    icon: "🎧",
    description: "A quiet space for deep listening.",
    order: 2,
    content: {
      themeKey: "philosophy",
      subjects: [
        { key: "silence", label: "Silence" },
        { key: "presence", label: "Presence" },
        { key: "attention", label: "Attention" },
        { key: "compassion", label: "Compassion" },
      ],
    },
  },
  {
    tableId: "lantern",
    name: "The Lantern Table",
    icon: "🏮",
    description: "A space for clarity and thoughtful questions.",
    order: 3,
    content: {
      themeKey: "philosophy",
      subjects: [
        { key: "truth", label: "Truth" },
        { key: "knowledge", label: "Knowledge" },
        { key: "wisdom", label: "Wisdom" },
        { key: "clarity", label: "Clarity" },
      ],
    },
  },
  {
    tableId: "bridge",
    name: "The Bridge",
    icon: "🌉",
    description: "A circle for connecting perspectives.",
    order: 4,
    content: {
      themeKey: "philosophy",
      subjects: [
        { key: "connection", label: "Connection" },
        { key: "dialogue", label: "Dialogue" },
        { key: "understanding", label: "Understanding" },
        { key: "empathy", label: "Empathy" },
      ],
    },
  },
  {
    tableId: "spark",
    name: "The Spark",
    icon: "⚡",
    description: "A lively space for active exchange.",
    order: 5,
    content: {
      themeKey: "philosophy",
      subjects: [
        { key: "passion", label: "Passion" },
        { key: "creativity", label: "Creativity" },
        { key: "energy", label: "Energy" },
        { key: "vitality", label: "Vitality" },
      ],
    },
  },
  {
    tableId: "flow",
    name: "The Flow",
    icon: "🌊",
    description: "A space where conversation flows naturally.",
    order: 6,
    content: {
      themeKey: "philosophy",
      subjects: [
        { key: "change", label: "Change" },
        { key: "time", label: "Time" },
        { key: "impermanence", label: "Impermanence" },
        { key: "acceptance", label: "Acceptance" },
      ],
    },
  },
];

// Helper functions
export function getTableDefinition(
  tableId: string,
): TableDefinition | undefined {
  return TABLE_DEFINITIONS.find((table) => table.tableId === tableId);
}

export function isValidTableId(tableId: string): boolean {
  return TABLE_DEFINITIONS.some((table) => table.tableId === tableId);
}

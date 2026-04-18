"use strict";
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
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TABLE_DEFINITIONS = void 0;
exports.getTableDefinition = getTableDefinition;
exports.isValidTableId = isValidTableId;
exports.TABLE_DEFINITIONS = [
    {
        tableId: "hearth",
        name: "The Hearth",
        icon: "🔥",
        description: "A welcoming circle for open conversation.",
        order: 1,
    },
    {
        tableId: "listening",
        name: "The Listening Room",
        icon: "🎧",
        description: "A quiet space for deep listening.",
        order: 2,
    },
    {
        tableId: "lantern",
        name: "The Lantern Table",
        icon: "🏮",
        description: "A space for clarity and thoughtful questions.",
        order: 3,
    },
    {
        tableId: "bridge",
        name: "The Bridge",
        icon: "🌉",
        description: "A circle for connecting perspectives.",
        order: 4,
    },
    {
        tableId: "spark",
        name: "The Spark",
        icon: "⚡",
        description: "A lively space for active exchange.",
        order: 5,
    },
    {
        tableId: "flow",
        name: "The Flow",
        icon: "🌊",
        description: "A space where conversation flows naturally.",
        order: 6,
    },
];
// Helper functions
function getTableDefinition(tableId) {
    return exports.TABLE_DEFINITIONS.find((table) => table.tableId === tableId);
}
function isValidTableId(tableId) {
    return exports.TABLE_DEFINITIONS.some((table) => table.tableId === tableId);
}

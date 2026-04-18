"use strict";
// avatarManager.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.emojiLookup = void 0;
exports.getAvailableAvatars = getAvailableAvatars;
exports.claimAvatar = claimAvatar;
exports.releaseAvatarByName = releaseAvatarByName;
const avatarPool = [
    { id: "Monk", emoji: "🧘" },
    { id: "Pharaoh", emoji: "🛕" },
    { id: "Elemental", emoji: "🔥" },
    { id: "Ninja", emoji: "🥷" },
    { id: "Wolves", emoji: "🐺" },
    { id: "Pirate", emoji: "🏴‍☠️" },
    { id: "Panda", emoji: "🐼" },
    { id: "Farmer", emoji: "👨‍🌾" },
    { id: "TennisPlayer", emoji: "🎾" },
    { id: "Chipmunks", emoji: "🐿️" },
    { id: "BabyDragon", emoji: "🐉" },
    { id: "Baby", emoji: "👶" },
];
exports.emojiLookup = Object.fromEntries(avatarPool.map(({ id, emoji }) => [id, emoji]));
// Phase E: Room-scoped avatar assignments
const avatarAssignmentsByRoom = new Map(); // roomId -> (avatarId -> name)
/**
 * Get or create avatar assignments for a room
 */
function getAvatarAssignments(roomId) {
    if (!avatarAssignmentsByRoom.has(roomId)) {
        avatarAssignmentsByRoom.set(roomId, new Map());
    }
    return avatarAssignmentsByRoom.get(roomId);
}
function getAvailableAvatars(roomId = "default-room") {
    const assignments = getAvatarAssignments(roomId);
    return avatarPool.map((avatar) => ({
        ...avatar,
        takenBy: assignments.get(avatar.id) || null,
    }));
}
function claimAvatar(avatarId, name, roomId = "default-room") {
    if (!avatarPool.find((a) => a.id === avatarId))
        return false; // invalid
    const assignments = getAvatarAssignments(roomId);
    if (assignments.has(avatarId))
        return false; // already taken in this room
    assignments.set(avatarId, name);
    return true;
}
function releaseAvatarByName(name, roomId) {
    if (roomId) {
        // Release from specific room
        const assignments = getAvatarAssignments(roomId);
        for (const [avatarId, assignedName] of assignments.entries()) {
            if (assignedName === name) {
                assignments.delete(avatarId);
            }
        }
    }
    else {
        // Release from all rooms (for backward compatibility)
        for (const assignments of avatarAssignmentsByRoom.values()) {
            for (const [avatarId, assignedName] of assignments.entries()) {
                if (assignedName === name) {
                    assignments.delete(avatarId);
                }
            }
        }
    }
}

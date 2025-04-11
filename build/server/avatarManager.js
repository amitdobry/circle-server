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
exports.emojiLookup = Object.fromEntries(
  avatarPool.map(({ id, emoji }) => [id, emoji])
);
const avatarAssignments = new Map(); // avatarId -> name
function getAvailableAvatars() {
  return avatarPool.map((avatar) => ({
    ...avatar,
    takenBy: avatarAssignments.get(avatar.id) || null,
  }));
}
function claimAvatar(avatarId, name) {
  if (!avatarPool.find((a) => a.id === avatarId)) return false; // invalid
  if (avatarAssignments.has(avatarId)) return false; // already taken
  avatarAssignments.set(avatarId, name);
  return true;
}
function releaseAvatarByName(name) {
  for (const [avatarId, assignedName] of avatarAssignments.entries()) {
    if (assignedName === name) {
      avatarAssignments.delete(avatarId);
    }
  }
}

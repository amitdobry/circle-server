// avatarManager.ts

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

export const emojiLookup: Record<string, string> = Object.fromEntries(
  avatarPool.map(({ id, emoji }) => [id, emoji])
);

const avatarAssignments = new Map<string, string>(); // avatarId -> name

export function getAvailableAvatars() {
  return avatarPool.map((avatar) => ({
    ...avatar,
    takenBy: avatarAssignments.get(avatar.id) || null,
  }));
}

export function claimAvatar(avatarId: string, name: string): boolean {
  if (!avatarPool.find((a) => a.id === avatarId)) return false; // invalid
  if (avatarAssignments.has(avatarId)) return false; // already taken
  avatarAssignments.set(avatarId, name);
  return true;
}

export function releaseAvatarByName(name: string) {
  for (const [avatarId, assignedName] of avatarAssignments.entries()) {
    if (assignedName === name) {
      avatarAssignments.delete(avatarId);
    }
  }
}

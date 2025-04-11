// avatarManager.ts

const avatarPool = [
  { id: "Monkv2", emoji: "🧘" },
  { id: "Pharaohv2", emoji: "🛕" },
  { id: "Elementalv2", emoji: "🔥" },
  { id: "Ninjav2", emoji: "🥷" },
  { id: "Wolvesv2", emoji: "🐺" },
  { id: "Piratev2", emoji: "🏴‍☠️" },
  { id: "Pandav2", emoji: "🐼" },
  { id: "Farmerv2", emoji: "👨‍🌾" },
  { id: "TennisPlayerv2", emoji: "🎾" },
  { id: "Chipmunksv2", emoji: "🐿️" },
  { id: "BabyDragonv2", emoji: "🐉" },
  { id: "Babyv2", emoji: "👶" },
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

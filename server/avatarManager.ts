// avatarManager.ts

const avatarPool = [
  { id: "monkv2", emoji: "🧘" },
  { id: "pharaohv2", emoji: "🛕" },
  { id: "elementalv2", emoji: "🔥" },
  { id: "ninjav2", emoji: "🥷" },
  { id: "wolvesv2", emoji: "🐺" },
  { id: "piratev2", emoji: "🏴‍☠️" },
  { id: "pandav2", emoji: "🐼" },
  { id: "farmerv2", emoji: "👨‍🌾" },
  { id: "tennisPlayerv2", emoji: "🎾" },
  { id: "chipmunksv2", emoji: "🐿️" },
  { id: "babyDragonv2", emoji: "🐉" },
  { id: "babyv2", emoji: "👶" },
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

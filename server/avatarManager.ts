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
  avatarPool.map(({ id, emoji }) => [id, emoji]),
);

// Phase E: Room-scoped avatar assignments
const avatarAssignmentsByRoom = new Map<string, Map<string, string>>(); // roomId -> (avatarId -> name)

/**
 * Get or create avatar assignments for a room
 */
function getAvatarAssignments(roomId: string): Map<string, string> {
  if (!avatarAssignmentsByRoom.has(roomId)) {
    avatarAssignmentsByRoom.set(roomId, new Map());
  }
  return avatarAssignmentsByRoom.get(roomId)!;
}

export function getAvailableAvatars(roomId: string = "default-room") {
  const assignments = getAvatarAssignments(roomId);

  // ✅ FIX: Build combined view WITHOUT mutating V1 assignments
  // Create a temporary combined map (V1 + V2 ghosts)
  const combinedAssignments = new Map(assignments);

  // Also check V2 participants (both CONNECTED and GHOST) to keep their avatars locked
  try {
    const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
    const roomState = roomRegistry.getRoom(roomId);

    if (roomState && roomState.participants) {
      // Add ALL participants' avatars to the TEMPORARY combined view
      for (const [, participant] of roomState.participants as Map<
        string,
        any
      >) {
        // Lock avatars for both CONNECTED and GHOST users
        if (participant.avatarId) {
          // Only add if not already assigned (avoid duplicates)
          if (!combinedAssignments.has(participant.avatarId)) {
            combinedAssignments.set(
              participant.avatarId,
              participant.displayName,
            );
          }
        }
      }
    }
  } catch (error) {
    // V2 not available or room doesn't exist, continue with V1 only
  }

  return avatarPool.map((avatar) => ({
    ...avatar,
    takenBy: combinedAssignments.get(avatar.id) || null,
  }));
}

export function claimAvatar(
  avatarId: string,
  name: string,
  roomId: string = "default-room",
): boolean {
  if (!avatarPool.find((a) => a.id === avatarId)) return false; // invalid
  const assignments = getAvatarAssignments(roomId);
  if (assignments.has(avatarId)) return false; // already taken in this room
  assignments.set(avatarId, name);
  return true;
}

export function releaseAvatarByName(name: string, roomId?: string) {
  if (roomId) {
    // Release from specific room
    const assignments = getAvatarAssignments(roomId);
    for (const [avatarId, assignedName] of assignments.entries()) {
      if (assignedName === name) {
        assignments.delete(avatarId);
      }
    }
  } else {
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

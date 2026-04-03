/**
 * Engine V2: Selectors
 *
 * Helper functions for querying TableState.
 * These are pure functions that do NOT mutate state.
 */

import { TableState, ParticipantState } from "./types";

// ============================================================================
// PARTICIPANT QUERIES
// ============================================================================

/**
 * Get all CONNECTED participants.
 */
export function getConnectedParticipants(
  tableState: TableState,
): ParticipantState[] {
  return Array.from(tableState.participants.values()).filter(
    (p) => p.presence === "CONNECTED",
  );
}

/**
 * Get all GHOST participants.
 */
export function getGhostParticipants(
  tableState: TableState,
): ParticipantState[] {
  return Array.from(tableState.participants.values()).filter(
    (p) => p.presence === "GHOST",
  );
}

/**
 * Get participant by userId.
 */
export function getParticipant(
  tableState: TableState,
  userId: string,
): ParticipantState | undefined {
  return tableState.participants.get(userId);
}

/**
 * Get participant by socketId (for socket event handling).
 */
export function getParticipantBySocketId(
  tableState: TableState,
  socketId: string,
): ParticipantState | undefined {
  for (const participant of tableState.participants.values()) {
    if (participant.socketId === socketId) {
      return participant;
    }
  }
  return undefined;
}

/**
 * Get the live speaker participant.
 */
export function getLiveSpeaker(
  tableState: TableState,
): ParticipantState | null {
  if (!tableState.liveSpeaker) return null;
  return tableState.participants.get(tableState.liveSpeaker) || null;
}

// ============================================================================
// POINTER QUERIES
// ============================================================================

/**
 * Get who a user is pointing to.
 */
export function getPointerTarget(
  tableState: TableState,
  userId: string,
): string | null {
  return tableState.pointerMap.get(userId) || null;
}

/**
 * Get all users pointing to a specific target.
 */
export function getPointersToTarget(
  tableState: TableState,
  targetUserId: string,
): string[] {
  const pointers: string[] = [];
  for (const [pointerId, targetId] of tableState.pointerMap.entries()) {
    if (targetId === targetUserId) {
      pointers.push(pointerId);
    }
  }
  return pointers;
}

/**
 * Count votes for each candidate.
 * Only counts CONNECTED participants.
 */
export function getVoteCounts(tableState: TableState): Map<string, number> {
  const votes = new Map<string, number>();
  const connected = getConnectedParticipants(tableState);

  for (const participant of connected) {
    const target = tableState.pointerMap.get(participant.userId);
    if (target) {
      votes.set(target, (votes.get(target) || 0) + 1);
    }
  }

  return votes;
}

// ============================================================================
// CONSENSUS QUERIES
// ============================================================================

/**
 * Evaluate consensus: all CONNECTED users point to the same target.
 * Returns the consensus candidate userId, or null if no consensus.
 */
export function evaluateConsensus(tableState: TableState): string | null {
  const connected = getConnectedParticipants(tableState);

  // No connected users = no consensus
  if (connected.length === 0) return null;

  const votes = getVoteCounts(tableState);

  // Find candidate with unanimous vote
  for (const [candidate, count] of votes.entries()) {
    if (count === connected.length) {
      return candidate; // Unanimous
    }
  }

  return null; // No consensus
}

/**
 * Check if consensus is currently achieved.
 */
export function hasConsensus(tableState: TableState): boolean {
  return evaluateConsensus(tableState) !== null;
}

// ============================================================================
// PHASE QUERIES
// ============================================================================

/**
 * Check if timer has expired.
 */
export function isTimerExpired(tableState: TableState): boolean {
  if (!tableState.timer.active) return false;
  if (!tableState.timer.endTime) return false;
  return Date.now() >= tableState.timer.endTime;
}

/**
 * Get remaining time in milliseconds.
 */
export function getRemainingTime(tableState: TableState): number {
  if (!tableState.timer.active || !tableState.timer.endTime) return 0;
  const remaining = tableState.timer.endTime - Date.now();
  return Math.max(0, remaining);
}

/**
 * Check if room is in grace period (ENDING phase).
 */
export function isInGracePeriod(tableState: TableState): boolean {
  return tableState.phase === "ENDING";
}

/**
 * Check if room should be cleaned up.
 */
export function shouldCleanup(tableState: TableState): boolean {
  // All participants left
  if (tableState.participants.size === 0) return true;

  // Phase is ENDED
  if (tableState.phase === "ENDED") return true;

  return false;
}

// ============================================================================
// AVATAR QUERIES
// ============================================================================

/**
 * Check if an avatar is available (not taken by CONNECTED or GHOST user).
 */
export function isAvatarAvailable(
  tableState: TableState,
  avatarId: string,
): boolean {
  for (const participant of tableState.participants.values()) {
    if (
      participant.avatarId === avatarId &&
      (participant.presence === "CONNECTED" || participant.presence === "GHOST")
    ) {
      return false; // Avatar is taken
    }
  }
  return true; // Avatar is available
}

/**
 * Get all taken avatars.
 */
export function getTakenAvatars(tableState: TableState): string[] {
  const taken = new Set<string>();
  for (const participant of tableState.participants.values()) {
    if (
      participant.presence === "CONNECTED" ||
      participant.presence === "GHOST"
    ) {
      taken.add(participant.avatarId);
    }
  }
  return Array.from(taken);
}

// ============================================================================
// SERIALIZATION HELPERS
// ============================================================================

/**
 * Serialize participants Map to array for network transmission.
 */
export function serializeParticipants(tableState: TableState) {
  return Array.from(tableState.participants.values()).map((p) => ({
    userId: p.userId,
    socketId: p.socketId,
    displayName: p.displayName,
    avatarId: p.avatarId,
    role: p.role,
    presence: p.presence,
    attentionTarget: p.attentionTarget,
    joinedAt: p.joinedAt,
    lastSeen: p.lastSeen,
  }));
}

/**
 * Serialize pointerMap to object for network transmission.
 */
export function serializePointerMap(
  tableState: TableState,
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of tableState.pointerMap.entries()) {
    obj[key] = value;
  }
  return obj;
}

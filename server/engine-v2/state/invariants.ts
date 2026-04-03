/**
 * Engine V2: Invariants
 *
 * These are non-negotiable rules that MUST be true after every state mutation.
 * If any invariant fails, the engine has a bug.
 *
 * Invariants are checked after every dispatch in development mode.
 */

import { TableState, InvariantViolation } from "./types";
import { getConnectedParticipants } from "./selectors";

// ============================================================================
// MAIN INVARIANT CHECKER
// ============================================================================

/**
 * Validates all invariants for a TableState.
 * Throws InvariantViolation if any check fails.
 *
 * @throws {InvariantViolation} If any invariant is violated
 */
export function assertInvariants(tableState: TableState): void {
  const { phase, liveSpeaker, syncPause, participants, pointerMap } =
    tableState;

  // Invariant 1: Single Live Speaker Exists
  // If liveSpeaker is set, that user must exist in participants
  if (liveSpeaker !== null && !participants.has(liveSpeaker)) {
    throw new InvariantViolation(
      `liveSpeaker '${liveSpeaker}' does not exist in participants`,
    );
  }

  // Invariant 2: Pointer Validity
  // All keys in pointerMap must exist in participants
  // All values in pointerMap must exist in participants
  for (const [pointerId, targetId] of pointerMap.entries()) {
    if (!participants.has(pointerId)) {
      throw new InvariantViolation(
        `pointerMap has pointer from '${pointerId}' but user not in participants`,
      );
    }
    if (!participants.has(targetId)) {
      throw new InvariantViolation(
        `pointerMap points to '${targetId}' but user not in participants`,
      );
    }
  }

  // Invariant 3: Ghost Exclusion from Consensus
  // This is enforced in consensus logic, not state structure
  // (No structural check needed here)

  // Invariant 4: No Cross-Room State Leakage
  // Enforced by registry architecture, not checkable here
  // (RoomRegistry Map ensures isolation)

  // Invariant 5: Room-Scoped Emits Only
  // Enforced by effect types and runEffects implementation
  // (No io.emit() allowed in codebase)

  // Invariant 6: No Direct State Mutation
  // Enforced by dispatch architecture
  // (All mutations must go through reducer)

  // Invariant 7: LIVE_SPEAKER Phase Requires Speaker
  // If phase is LIVE_SPEAKER, liveSpeaker must be set
  if (phase === "LIVE_SPEAKER" && liveSpeaker === null) {
    throw new InvariantViolation(
      `phase is LIVE_SPEAKER but liveSpeaker is null`,
    );
  }

  // Invariant 7b: SYNC_PAUSE Phase Flag Consistency
  // If phase is SYNC_PAUSE, syncPause flag must be true
  if (phase === "SYNC_PAUSE" && syncPause !== true) {
    throw new InvariantViolation(
      `phase is SYNC_PAUSE but syncPause flag is false`,
    );
  }

  // Invariant 8: Avatar Uniqueness per Room
  // No two CONNECTED or GHOST users can have the same avatarId
  const activeAvatars = new Map<string, string>(); // avatarId -> userId
  for (const [userId, participant] of participants.entries()) {
    if (
      participant.presence === "CONNECTED" ||
      participant.presence === "GHOST"
    ) {
      const existingUser = activeAvatars.get(participant.avatarId);
      if (existingUser) {
        throw new InvariantViolation(
          `Avatar '${participant.avatarId}' is used by both '${existingUser}' and '${userId}'`,
        );
      }
      activeAvatars.set(participant.avatarId, userId);
    }
  }

  // Invariant 9: Speaker Must Be Connected or Ghost (UPDATED: Feb 21, 2026)
  // If liveSpeaker is set, that participant must have presence = CONNECTED or GHOST
  // Ghost speakers keep mic until they reconnect or all users ghost
  if (liveSpeaker !== null) {
    const speaker = participants.get(liveSpeaker);
    if (!speaker) {
      throw new InvariantViolation(
        `liveSpeaker '${liveSpeaker}' does not exist in participants`,
      );
    }
    if (speaker.presence !== "CONNECTED" && speaker.presence !== "GHOST") {
      throw new InvariantViolation(
        `liveSpeaker '${liveSpeaker}' has presence '${speaker.presence}', expected CONNECTED or GHOST`,
      );
    }
  }

  // Invariant 10: Session Cannot Deadlock
  // If all users are GHOST, phase should transition to ENDING
  // (This is enforced in phase transition logic, not state structure)
  const connected = getConnectedParticipants(tableState);
  const ghosts = Array.from(participants.values()).filter(
    (p) => p.presence === "GHOST",
  );
  if (connected.length === 0 && ghosts.length > 0) {
    if (phase !== "ENDING" && phase !== "ENDED") {
      throw new InvariantViolation(
        `All users are GHOST but phase is '${phase}', expected ENDING or ENDED`,
      );
    }
  }

  // Invariant 11: ATTENTION_SELECTION Phase Exclusivity
  // If phase is ATTENTION_SELECTION, liveSpeaker must be null
  if (phase === "ATTENTION_SELECTION" && liveSpeaker !== null) {
    throw new InvariantViolation(
      `phase is ATTENTION_SELECTION but liveSpeaker is set to '${liveSpeaker}'`,
    );
  }

  // Invariant 12: LOBBY Initialization
  // If phase is LOBBY, liveSpeaker must be null and syncPause false
  if (phase === "LOBBY") {
    if (liveSpeaker !== null) {
      throw new InvariantViolation(
        `phase is LOBBY but liveSpeaker is set to '${liveSpeaker}'`,
      );
    }
    if (syncPause !== false) {
      throw new InvariantViolation(`phase is LOBBY but syncPause is true`);
    }
  }

  // Invariant 13: TRANSITION Phase Coherence
  // If phase is TRANSITION, liveSpeaker must be set (handoff in progress)
  if (phase === "TRANSITION" && liveSpeaker === null) {
    throw new InvariantViolation(
      `phase is TRANSITION but liveSpeaker is null (handoff requires outgoing speaker)`,
    );
  }

  // Invariant 14: ENDING/ENDED Cleanup
  // If phase is ENDING or ENDED, liveSpeaker must be null
  if ((phase === "ENDING" || phase === "ENDED") && liveSpeaker !== null) {
    throw new InvariantViolation(
      `phase is ${phase} but liveSpeaker is still set to '${liveSpeaker}'`,
    );
  }
}

// ============================================================================
// DEVELOPMENT MODE CHECK
// ============================================================================

/**
 * Wrapper that only runs invariant checks in development mode.
 * In production, invariant checks are skipped for performance.
 */
export function assertInvariantsIfDev(tableState: TableState): void {
  if (process.env.NODE_ENV !== "production") {
    assertInvariants(tableState);
  }
}

// ============================================================================
// INVARIANT DESCRIPTIONS (For Documentation)
// ============================================================================

export const INVARIANT_DESCRIPTIONS = [
  "1. Single Live Speaker: liveSpeaker must exist in participants or be null",
  "2. Pointer Validity: All pointerMap keys and values must exist in participants",
  "3. Ghost Exclusion: Only CONNECTED users count toward consensus",
  "4. Room Isolation: No cross-room state leakage (architectural)",
  "5. Scoped Emits: No io.emit() allowed, only io.to(roomId).emit()",
  "6. Dispatch Only: All mutations must go through dispatch()",
  "7. Phase Consistency: LIVE_SPEAKER ⇒ liveSpeaker !== null, SYNC_PAUSE ⇒ syncPause === true",
  "8. Avatar Uniqueness: No duplicate avatars among CONNECTED/GHOST users",
  "9. Speaker Connected: liveSpeaker must have presence === CONNECTED",
  "10. No Deadlock: All GHOST ⇒ phase === ENDING or ENDED",
  "11. Picker Exclusivity: ATTENTION_SELECTION ⇒ liveSpeaker === null",
  "12. Lobby Initialization: LOBBY ⇒ liveSpeaker === null AND syncPause === false",
  "13. Transition Coherence: TRANSITION ⇒ liveSpeaker !== null",
  "14. Ending Cleanup: ENDING/ENDED ⇒ liveSpeaker === null",
] as const;

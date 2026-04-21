/**
 * Participant lifecycle helpers for Engine V2
 *
 * Safe removal of participants from room state.
 * Handles all cleanup and invalidation of references.
 */

import { TableState, ParticipantState as Participant } from "./types";
import { invalidateSpeaker, isSpeaker } from "./speakerLifecycle";

export type RemoveReason =
  | "LEAVE"
  | "PURGE_GHOST"
  | "KICK"
  | "ADMIN_REMOVE"
  | "SESSION_END";

export interface RemovalResult {
  removed: boolean;
  removedParticipant?: Participant;
  speakerWasInvalidated: boolean;
}

/**
 * Safely remove a participant from room state.
 *
 * Two-step process:
 * 1. If they're the speaker, invalidate the speaking moment
 * 2. Remove them from participants and clean up references
 *
 * Use this for:
 * - LEAVE_SESSION (user voluntarily leaves)
 * - PURGE_GHOST (ghost timeout expires)
 * - KICK_USER (admin/moderator removal)
 * - SESSION_END cleanup (if applicable)
 *
 * Do NOT use for:
 * - DISCONNECT (becomes ghost, not removed)
 * - RECONNECT (restores existing participant)
 *
 * @param tableState - The room state
 * @param userId - The userId (stable UUID) to remove
 * @param reason - Why they're being removed (for logging)
 * @returns Removal result with metadata
 */
export function removeParticipantSafely(
  tableState: TableState,
  userId: string,
  reason: RemoveReason,
): RemovalResult {
  const participant = tableState.participants.get(userId);

  if (!participant) {
    // Already removed or never existed - safe no-op
    return {
      removed: false,
      speakerWasInvalidated: false,
    };
  }

  console.log(
    `[V2 Lifecycle] 🗑️ Removing participant: ${participant.displayName} (${reason})`,
  );

  // Step 1: Invalidate speaker if needed
  const speakerWasInvalidated = isSpeaker(tableState, userId)
    ? invalidateSpeaker(tableState, reason)
    : false;

  // Step 2: Clean up pointer references
  // Remove pointers FROM this user
  tableState.pointerMap.delete(userId);

  // Remove pointers TO this user (unless already cleared by invalidateSpeaker)
  if (!speakerWasInvalidated) {
    for (const [from, to] of tableState.pointerMap.entries()) {
      if (to === userId) {
        tableState.pointerMap.delete(from);
      }
    }
  }

  // Step 3: Remove from participants
  tableState.participants.delete(userId);

  console.log(
    `[V2 Lifecycle] ✅ Removed ${participant.displayName} | Remaining: ${tableState.participants.size}`,
  );

  return {
    removed: true,
    removedParticipant: participant,
    speakerWasInvalidated,
  };
}

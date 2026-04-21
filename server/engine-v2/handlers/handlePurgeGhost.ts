/**
 * Handle PURGE_GHOST Action
 *
 * Encapsulates all business logic for ghost timeout cleanup:
 * - Remove ghost participant after 3-minute timeout
 * - Only purge if still in GHOST state (not if reconnected)
 * - Clear pointers and emit events
 * - Rebuild panels
 *
 * ⚠️ TRANSITIONAL ARCHITECTURE:
 * - V2 TableState is the ONLY source of truth
 * - update-pointing events are TEMPORARY UI sync (to be removed)
 * - panelConfig snapshot is AUTHORITATIVE and must win on conflict
 * - V1 SpeakerManager is cache/adapter ONLY, never authoritative
 *
 * TODO: Migrate to snapshot-only model:
 * 1. Extend panelConfig payload to include pointer state
 * 2. Update client to consume pointers from panelConfig
 * 3. Remove update-pointing events from this handler
 */

import { TableState, Effect } from "../state/types";
import { serializePointerMap } from "../state/selectors";
import { removeParticipantSafely } from "../state/participantLifecycle";

export function handlePurgeGhost(
  tableState: TableState,
  ghostUserId: string,
): Effect[] {
  const effects: Effect[] = [];

  console.log(`[handlePurgeGhost] 🧹 Purging ghost ${ghostUserId}...`);

  const participant = tableState.participants.get(ghostUserId);

  if (!participant) {
    console.log(`[handlePurgeGhost] ⚠️ User ${ghostUserId} already removed`);
    return [];
  }

  // Only purge if still a ghost (they might have reconnected)
  if (participant.presence !== "GHOST") {
    console.log(
      `[handlePurgeGhost] ✅ ${participant.displayName} reconnected, skipping cleanup`,
    );
    return [];
  }

  // ========================================================================
  // STEP 1: Collect pointers BEFORE removal for client clear events
  // ========================================================================
  const pointersToCleared: Array<{ from: string; to: string }> = [];

  // Pointers FROM the ghost (should already be cleared on disconnect, but be safe)
  const ghostPointer = tableState.pointerMap.get(ghostUserId);
  if (ghostPointer) {
    const target = tableState.participants.get(ghostPointer);
    if (target) {
      pointersToCleared.push({
        from: participant.displayName,
        to: target.displayName,
      });
    }
  }

  // Pointers TO the ghost
  for (const [fromUserId, toUserId] of tableState.pointerMap.entries()) {
    if (toUserId === ghostUserId) {
      const fromParticipant = tableState.participants.get(fromUserId);
      if (fromParticipant) {
        pointersToCleared.push({
          from: fromParticipant.displayName,
          to: participant.displayName,
        });
      }
    }
  }

  // If ghost was speaker (shouldn't happen, but be defensive), collect ALL pointers
  if (tableState.liveSpeaker === ghostUserId) {
    console.warn(
      `[handlePurgeGhost] ⚠️ Ghost ${participant.displayName} was still marked as speaker!`,
    );
    for (const [fromUserId, toUserId] of tableState.pointerMap.entries()) {
      const fromP = tableState.participants.get(fromUserId);
      const toP = tableState.participants.get(toUserId);
      if (
        fromP &&
        toP &&
        fromUserId !== ghostUserId &&
        toUserId !== ghostUserId
      ) {
        if (
          !pointersToCleared.some(
            (p) => p.from === fromP.displayName && p.to === toP.displayName,
          )
        ) {
          pointersToCleared.push({
            from: fromP.displayName,
            to: toP.displayName,
          });
        }
      }
    }
  }

  // ========================================================================
  // STEP 2: Calculate ghost duration
  // ========================================================================
  const ghostDuration = Date.now() - participant.lastSeen;
  const ghostMinutes = Math.floor(ghostDuration / 60000);

  console.log(
    `[handlePurgeGhost] 🧹 Removing ${participant.displayName} (ghosted for ${ghostMinutes}m)`,
  );

  // ========================================================================
  // STEP 3: Remove participant (handles speaker invalidation internally)
  // ========================================================================
  const result = removeParticipantSafely(
    tableState,
    ghostUserId,
    "PURGE_GHOST",
  );

  // ========================================================================
  // STEP 4: Emit pointer clear events for client UI
  // ⚠️ TRANSITIONAL: These are temporary UI sync events
  // TODO: Remove once client consumes pointer state from panelConfig snapshot
  // Panel snapshot (REBUILD_ALL_PANELS) is the authoritative source
  // ========================================================================
  for (const pointer of pointersToCleared) {
    effects.push({
      type: "SOCKET_EMIT_ROOM",
      roomId: tableState.roomId,
      event: "update-pointing",
      data: { from: pointer.from, to: null },
    });
  }

  console.log(
    `[handlePurgeGhost] ✅ Purged ${participant.displayName} | Remaining: ${tableState.participants.size}`,
  );

  // ========================================================================
  // STEP 5: Return effects
  // ========================================================================
  effects.push(
    {
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: `${participant.displayName} timed out after ${ghostMinutes} minutes`,
      level: "info",
    },
    {
      type: "SOCKET_EMIT_ROOM",
      roomId: tableState.roomId,
      event: "v2:ghost-purged",
      data: {
        userId: ghostUserId,
        displayName: participant.displayName,
        avatarId: participant.avatarId,
        ghostDuration: ghostDuration,
      },
    },
    {
      type: "REBUILD_ALL_PANELS",
      roomId: tableState.roomId,
    },
  );

  return effects;
}

/**
 * Handle LEAVE_SESSION Action
 *
 * Encapsulates all business logic for when a user voluntarily leaves:
 * - Remove participant completely (not just ghost)
 * - If they were speaker, invalidate speaking moment
 * - Clear all pointers and emit events
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
import {
  getParticipantBySocketId,
  findParticipantByDisplayName,
  serializePointerMap,
} from "../state/selectors";
import { removeParticipantSafely } from "../state/participantLifecycle";

export function handleLeaveSession(
  tableState: TableState,
  userId: string,
  displayName?: string,
): Effect[] {
  const effects: Effect[] = [];

  // Find participant
  const leaver =
    getParticipantBySocketId(tableState, userId) ||
    (displayName
      ? findParticipantByDisplayName(tableState, displayName)
      : null);

  if (!leaver) {
    console.warn(`[handleLeaveSession] ⚠️ User ${userId} not found`);
    return [];
  }

  console.log(
    `[handleLeaveSession] 👋 ${leaver.displayName} leaving voluntarily...`,
  );

  // ========================================================================
  // STEP 1: Collect pointers BEFORE removal for client clear events
  // ========================================================================
  const pointersToCleared: Array<{ from: string; to: string }> = [];

  // Pointers FROM the leaver
  const leaverPointer = tableState.pointerMap.get(leaver.userId);
  if (leaverPointer) {
    const target = tableState.participants.get(leaverPointer);
    if (target) {
      pointersToCleared.push({
        from: leaver.displayName,
        to: target.displayName,
      });
    }
  }

  // Pointers TO the leaver
  for (const [fromUserId, toUserId] of tableState.pointerMap.entries()) {
    if (toUserId === leaver.userId) {
      const fromParticipant = tableState.participants.get(fromUserId);
      if (fromParticipant) {
        pointersToCleared.push({
          from: fromParticipant.displayName,
          to: leaver.displayName,
        });
      }
    }
  }

  // If leaver was speaker, collect ALL pointers (will be cleared by invalidateSpeaker)
  if (tableState.liveSpeaker === leaver.userId) {
    for (const [fromUserId, toUserId] of tableState.pointerMap.entries()) {
      const fromP = tableState.participants.get(fromUserId);
      const toP = tableState.participants.get(toUserId);
      if (
        fromP &&
        toP &&
        fromUserId !== leaver.userId &&
        toUserId !== leaver.userId
      ) {
        // Don't duplicate pointers we already collected
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
  // STEP 2: Remove participant (handles speaker invalidation internally)
  // ========================================================================
  const result = removeParticipantSafely(tableState, leaver.userId, "LEAVE");

  // ========================================================================
  // STEP 3: Emit pointer clear events for client UI
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

  // ========================================================================
  // STEP 4: Check if all remaining participants are ghosts
  // ========================================================================
  const connectedCount = Array.from(tableState.participants.values()).filter(
    (p) => p.presence === "CONNECTED",
  ).length;

  if (connectedCount === 0 && tableState.participants.size > 0) {
    tableState.phase = "ENDING";
    console.log(
      `[handleLeaveSession] ⚠️ All participants are ghosts → phase = ENDING`,
    );
  }

  console.log(
    `[handleLeaveSession] ✅ ${leaver.displayName} left | Remaining: ${tableState.participants.size}`,
  );

  // ========================================================================
  // STEP 5: Return effects
  // ========================================================================
  effects.push(
    {
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: `${leaver.displayName} left the circle`,
      level: "info",
    },
    {
      type: "REBUILD_ALL_PANELS",
      roomId: tableState.roomId,
    },
  );

  return effects;
}

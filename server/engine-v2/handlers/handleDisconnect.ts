/**
 * Handle DISCONNECT Action
 *
 * Encapsulates all business logic for when a user disconnects:
 * - Set participant to GHOST
 * - Clear their pointer
 * - If they were speaker, invalidate speaking moment
 * - Broadcast pointer updates
 * - Rebuild panels
 * - Check for consensus
 * - Schedule ghost purge
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
  getConnectedParticipants,
  evaluateConsensus,
  serializePointerMap,
} from "../state/selectors";
import { invalidateSpeaker, isSpeaker } from "../state/speakerLifecycle";
import { removeVote, allUsersVoted } from "../content/contentPhaseLogic";
import {
  removeReadinessFromUser,
  allUsersReady,
} from "../round/roundLifecycle";
import * as ActionTypes from "../actions/actionTypes";

export function handleDisconnect(
  tableState: TableState,
  userId: string,
): Effect[] {
  const effects: Effect[] = [];

  // Find participant by socketId
  const participant = getParticipantBySocketId(tableState, userId);

  if (!participant) {
    console.warn(
      `[handleDisconnect] ⚠️ User ${userId} not found in participants`,
    );
    return [];
  }

  console.log(
    `[handleDisconnect] 👻 ${participant.displayName} disconnecting...`,
  );

  // ========================================================================
  // STEP 1: Set to GHOST
  // ========================================================================
  participant.presence = "GHOST";
  participant.socketId = null;
  participant.lastSeen = Date.now();

  // ========================================================================
  // STEP 1.5: Remove vote if in content phase (🆕 Content Phase Feature)
  // ========================================================================
  if (tableState.contentPhase && tableState.phase === "CONTENT_PHASE") {
    removeVote(tableState.contentPhase, participant.userId);

    // Check if remaining users all voted
    if (allUsersVoted(tableState.contentPhase, tableState.participants)) {
      console.log(
        `[handleDisconnect] ✅ All remaining users voted after ghost disconnect`,
      );

      effects.push({
        type: "DELAYED_ACTION",
        roomId: tableState.roomId,
        delayMs: 1000,
        action: {
          type: ActionTypes.RESOLVE_CONTENT_PHASE,
        },
      });
    }
  }

  // ========================================================================
  // STEP 1.6: Remove readiness if in active round (🆕 CRITICAL BUG FIX)
  // ========================================================================
  if (tableState.currentRound && tableState.currentRound.status === "active") {
    removeReadinessFromUser(tableState.currentRound, participant.userId);
    console.log(
      `[handleDisconnect] Removed readiness from user: ${participant.userId}`,
    );

    // Re-check consensus after removal
    if (allUsersReady(tableState.currentRound, tableState.participants)) {
      console.log(
        "[handleDisconnect] All remaining users ready - triggering new round",
      );

      effects.push({
        type: "DELAYED_ACTION",
        roomId: tableState.roomId,
        delayMs: 1500,
        action: {
          type: ActionTypes.START_CONTENT_PHASE,
        },
      });
    }

    // Emit updated readiness state
    effects.push({
      type: "EMIT_READINESS_UPDATE",
      roomId: tableState.roomId,
    });
  }

  // ========================================================================
  // STEP 2: Clear pointer (they can't point while disconnected)
  // ========================================================================
  const hadPointer = tableState.pointerMap.has(participant.userId);
  tableState.pointerMap.delete(participant.userId);

  // ⚠️ TRANSITIONAL: Emit pointer clear event for immediate UI feedback
  // TODO: Remove once client consumes pointer state from panelConfig snapshot
  // This is temporary UI sync - REBUILD_ALL_PANELS is authoritative
  if (hadPointer) {
    effects.push({
      type: "SOCKET_EMIT_ROOM",
      roomId: tableState.roomId,
      event: "update-pointing",
      data: { from: participant.displayName, to: null },
    });
  }

  // ========================================================================
  // STEP 3: If speaker disconnects, invalidate speaking moment
  // ========================================================================
  const wasSpeaker = isSpeaker(tableState, participant.userId);

  if (wasSpeaker) {
    console.log(
      `[handleDisconnect] 🔇 Speaker ${participant.displayName} disconnected - mic dropped`,
    );

    // Collect pointers BEFORE clearing (for update-pointing events)
    const pointersToCleared: Array<{ from: string; to: string }> = [];
    for (const [fromUserId, toUserId] of tableState.pointerMap.entries()) {
      const fromParticipant = tableState.participants.get(fromUserId);
      const toParticipant = tableState.participants.get(toUserId);
      if (fromParticipant && toParticipant) {
        pointersToCleared.push({
          from: fromParticipant.displayName,
          to: toParticipant.displayName,
        });
      }
    }

    // Invalidate speaker (clears liveSpeaker, phase → ATTENTION_SELECTION, clears pointerMap)
    invalidateSpeaker(tableState, "DISCONNECT");

    // ⚠️ TRANSITIONAL: Emit pointer clear events for immediate UI feedback
    // TODO: Remove once client consumes pointer state from panelConfig snapshot
    // These events provide temporary UX responsiveness - panel snapshot is authoritative
    for (const pointer of pointersToCleared) {
      effects.push({
        type: "SOCKET_EMIT_ROOM",
        roomId: tableState.roomId,
        event: "update-pointing",
        data: { from: pointer.from, to: null },
      });
    }

    effects.push(
      {
        type: "SYSTEM_LOG",
        roomId: tableState.roomId,
        message: `${participant.displayName} disconnected while speaking — mic dropped`,
        level: "info",
      },
      {
        type: "REBUILD_ALL_PANELS",
        roomId: tableState.roomId,
      },
    );
  } else {
    // ========================================================================
    // STEP 4: Not speaker - check if clearing their pointer creates consensus
    // ========================================================================
    if (hadPointer) {
      const consensusUserId = evaluateConsensus(tableState);

      if (consensusUserId && consensusUserId !== tableState.liveSpeaker) {
        const speaker = tableState.participants.get(consensusUserId);
        const connected = getConnectedParticipants(tableState);

        // Transition to LIVE_SPEAKER
        tableState.liveSpeaker = consensusUserId;
        tableState.syncPause = false;
        tableState.phase = "LIVE_SPEAKER";

        // Set speaker role, reset all others to listener
        for (const [, p] of tableState.participants) {
          p.role = p.userId === consensusUserId ? "speaker" : "listener";
        }

        console.log(
          `[handleDisconnect] 🎤 Consensus after ghost disconnect! ${speaker?.displayName} goes LIVE`,
        );

        effects.push(
          {
            type: "SYSTEM_LOG",
            roomId: tableState.roomId,
            message: `🎤 All attention on ${speaker?.displayName}. Going LIVE.`,
            level: "info",
          },
          {
            type: "SOCKET_EMIT_ROOM",
            roomId: tableState.roomId,
            event: "live-speaker",
            data: { name: speaker?.displayName, userId: consensusUserId },
          },
          {
            type: "REBUILD_ALL_PANELS",
            roomId: tableState.roomId,
          },
        );
      }
    }

    // Broadcast pointer update even if no consensus (user's pointer was cleared)
    if (hadPointer) {
      effects.push({
        type: "SOCKET_EMIT_ROOM",
        roomId: tableState.roomId,
        event: "pointer-map-updated",
        data: serializePointerMap(tableState),
      });
    }
  }

  // ========================================================================
  // STEP 5: Check if all users are ghosts
  // ========================================================================
  const connectedCount = Array.from(tableState.participants.values()).filter(
    (p) => p.presence === "CONNECTED",
  ).length;

  if (connectedCount === 0) {
    console.log(`[handleDisconnect] 💤 All users are ghosts, entering ENDING`);
    tableState.phase = "ENDING";
    tableState.liveSpeaker = null;

    effects.push({
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: `All users disconnected. Session paused.`,
      level: "warn",
    });
  }

  // ========================================================================
  // STEP 6: Broadcast ghost event
  // ========================================================================
  const ghostCount = Array.from(tableState.participants.values()).filter(
    (p) => p.presence === "GHOST",
  ).length;

  console.log(
    `[handleDisconnect] ✅ ${participant.displayName} → GHOST | Connected: ${connectedCount} | Ghosts: ${ghostCount}`,
  );

  effects.push(
    {
      type: "SOCKET_EMIT_ROOM",
      roomId: tableState.roomId,
      event: "v2:user-ghosted",
      data: {
        userId: participant.userId,
        displayName: participant.displayName,
        avatarId: participant.avatarId,
      },
    },
    {
      type: "DELAYED_ACTION",
      delayMs: 3 * 60 * 1000, // 3 minutes
      action: {
        type: "PURGE_GHOST",
        payload: { userId: participant.userId },
      },
      roomId: tableState.roomId,
    },
  );

  return effects;
}

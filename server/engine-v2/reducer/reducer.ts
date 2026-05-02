/**
 * Engine V2: Reducer
 *
 * Central router for all state transitions.
 * Routes actions to their corresponding transition functions.
 *
 * The reducer is a pure function that:
 * 1. Receives current state + action
 * 2. Calls the appropriate transition function
 * 3. Returns effects (side effects to execute)
 *
 * CRITICAL: The reducer MUTATES state directly (by design).
 * It does NOT return a new state (not Redux-style immutability).
 * This is for performance in a real-time multiplayer context.
 */

import { TableState, Action, Effect } from "../state/types";
import * as ActionTypes from "../actions/actionTypes";
import {
  createParticipantState,
  createContentPhaseState,
  createRound,
} from "../state/defaults";
import {
  evaluateConsensus,
  findParticipantByDisplayName,
  getParticipantBySocketId,
  getConnectedParticipants,
  serializePointerMap,
} from "../state/selectors";
import { invalidateSpeaker, isSpeaker } from "../state/speakerLifecycle";
import { removeParticipantSafely } from "../state/participantLifecycle";
import { handleDisconnect } from "../handlers/handleDisconnect";
import { handleLeaveSession } from "../handlers/handleLeaveSession";
import { handlePurgeGhost } from "../handlers/handlePurgeGhost";
import {
  castVote,
  removeVote,
  allUsersVoted,
  resolveVotes,
} from "../content/contentPhaseLogic";
import {
  markUserReady,
  unmarkUserReady,
  allUsersReady,
  endRound,
} from "../round/roundLifecycle";
import { contentConfigLoader } from "../../config/content/ContentConfigLoader";
import { getTableDefinition } from "../../ui-config/tableDefinitions";

// Import transition functions (to be created)
// import * as transitions from "./transitions";

// ============================================================================
// REDUCER (Central Router)
// ============================================================================

/**
 * Route an action to its transition function.
 *
 * @param tableState - Current room state (will be mutated)
 * @param userId - User performing the action (null for system actions)
 * @param action - The action to perform
 * @returns Array of effects to execute
 */
export function reducer(
  tableState: TableState,
  userId: string | null,
  action: Action,
): Effect[] {
  switch (action.type) {
    // ========================================================================
    // SESSION LIFECYCLE
    // ========================================================================

    case ActionTypes.JOIN_SESSION: {
      // =====================================================================
      // JOIN_SESSION: Add user to participants
      // =====================================================================
      console.log(
        `[V2 Reducer] 🚪 JOIN_SESSION | Room: ${tableState.roomId} | Session: ${tableState.sessionId} | User: ${userId}`,
      );

      if (!userId) {
        console.error(`[V2 Reducer] ❌ JOIN_SESSION requires userId`);
        return [];
      }

      const { displayName, avatarId, socketId } = action.payload || {};

      if (!displayName || !avatarId) {
        console.error(
          `[V2 Reducer] ❌ JOIN_SESSION missing required fields (displayName: ${displayName}, avatarId: ${avatarId})`,
        );
        return [];
      }

      // Check if user already exists (reconnect scenario)
      const existingParticipant = tableState.participants.get(userId);
      if (existingParticipant) {
        console.log(
          `[V2 Reducer] 🔄 User ${displayName} already exists, updating to CONNECTED`,
        );
        existingParticipant.presence = "CONNECTED";
        existingParticipant.socketId = socketId || null;
        existingParticipant.lastSeen = Date.now();

        return [
          {
            type: "SYSTEM_LOG",
            roomId: tableState.roomId,
            message: `${displayName} reconnected`,
            level: "info",
          },
        ];
      }

      // Check avatar availability — only block if another CONNECTED user holds it.
      // GHOST users vacated their seat; allow new users to claim their avatar.
      for (const [, participant] of tableState.participants) {
        if (
          participant.avatarId === avatarId &&
          participant.presence === "CONNECTED"
        ) {
          console.warn(
            `[V2 Reducer] ⚠️ Avatar ${avatarId} already taken by ${participant.displayName} (CONNECTED)`,
          );
          return [
            {
              type: "SOCKET_EMIT_USER",
              userId,
              event: "join-rejected",
              data: {
                reason: "Avatar already in use",
                avatarId,
              },
            },
          ];
        }
      }

      // Create new participant
      const newParticipant = createParticipantState(
        userId,
        displayName,
        avatarId,
        socketId || null,
      );

      // CRITICAL: Ensure presence is CONNECTED on join (not GHOST)
      newParticipant.presence = "CONNECTED";

      tableState.participants.set(userId, newParticipant);

      console.log(
        `[V2 Reducer] ✅ ${displayName} joined | Total participants: ${tableState.participants.size} | Phase: ${tableState.phase}`,
      );

      const effects: Effect[] = [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `${displayName} joined the circle`,
          level: "info",
        },
        {
          type: "SOCKET_EMIT_ROOM",
          roomId: tableState.roomId,
          event: "v2:user-joined",
          data: {
            userId,
            displayName,
            avatarId,
            participantCount: tableState.participants.size,
          },
        },
      ];

      // 🆕 Content Phase Feature: Start CONTENT_PHASE when 2+ users join (if feature enabled)
      const { FEATURE_CONTENT_PHASE } = require("../../config/featureFlags");

      if (FEATURE_CONTENT_PHASE) {
        const connectedCount = getConnectedParticipants(tableState).length;

        if (
          connectedCount >= 2 &&
          (tableState.phase === "LOBBY" ||
            tableState.phase === "ATTENTION_SELECTION") &&
          !tableState.contentPhase &&
          !tableState.currentRound
        ) {
          console.log(
            `[V2 Reducer] 🚀 Starting Content Phase (${connectedCount} users joined)`,
          );

          effects.push({
            type: "DELAYED_ACTION",
            roomId: tableState.roomId,
            delayMs: 500,
            action: {
              type: ActionTypes.START_CONTENT_PHASE,
            },
          });
        }

        // 🆕 If joining during an active round, push round state + readiness
        // to the whole room so the new joiner's client gets roundData and
        // can render the readiness row. Also updates everyone's total count.
        if (
          tableState.currentRound &&
          tableState.currentRound.status === "active"
        ) {
          console.log(
            `[V2 Reducer] 🔄 New joiner during active round — emitting round state to room`,
          );
          effects.push(
            { type: "EMIT_ROUND_STATE", roomId: tableState.roomId },
            { type: "EMIT_READINESS_UPDATE", roomId: tableState.roomId },
          );
        }
      }

      return effects;
    }

    case ActionTypes.LEAVE_SESSION: {
      // =====================================================================
      // LEAVE_SESSION: Delegate to handler
      // =====================================================================
      console.log(
        `[V2 Reducer] 👋 LEAVE_SESSION | Room: ${tableState.roomId} | User: ${userId}`,
      );

      if (!userId) return [];

      return handleLeaveSession(
        tableState,
        userId,
        action.payload?.displayName,
      );
    }

    case ActionTypes.DISCONNECT: {
      // =====================================================================
      // DISCONNECT: Delegate to handler
      // =====================================================================
      console.log(
        `[V2 Reducer] 👻 DISCONNECT | Room: ${tableState.roomId} | Session: ${tableState.sessionId} | User: ${userId}`,
      );

      if (!userId) {
        console.error(`[V2 Reducer] ❌ DISCONNECT requires userId`);
        return [];
      }

      return handleDisconnect(tableState, userId);
    }

    case ActionTypes.RECONNECT: {
      // =====================================================================
      // RECONNECT: Restore a GHOST user to CONNECTED with new socketId
      // =====================================================================
      console.log(
        `[V2 Reducer] 🔄 RECONNECT | Room: ${tableState.roomId} | User: ${userId}`,
      );

      if (!userId) return [];

      // Try to find by new socketId first, then by display name
      const displayName = action.payload?.displayName;
      const ghost = displayName
        ? findParticipantByDisplayName(tableState, displayName)
        : getParticipantBySocketId(tableState, userId);

      if (!ghost) {
        console.warn(
          `[V2 Reducer] ⚠️ RECONNECT: No matching participant for ${displayName ?? userId}`,
        );
        return [];
      }

      if (ghost.presence === "CONNECTED") {
        console.log(
          `[V2 Reducer] ⚠️ RECONNECT: ${ghost.displayName} is already CONNECTED, updating socketId`,
        );
      }

      // Restore presence and update socketId
      ghost.presence = "CONNECTED";
      ghost.socketId = userId; // userId = new socketId in shadow dispatch
      ghost.lastSeen = Date.now();

      // ✅ RECONNECT = FRESH PARTICIPATION (not state restoration)
      // Reset role to listener (ghost was observer, now fresh participant)
      ghost.role = "listener";

      // Clear attentionTarget (fresh entry)
      ghost.attentionTarget = null;

      const effects: Effect[] = [];

      // If this ghost was the live speaker, clear liveSpeaker and transition
      if (tableState.liveSpeaker === ghost.userId) {
        console.log(
          `[V2 Reducer] 🎤 Reconnected ghost was speaker, clearing liveSpeaker`,
        );
        tableState.liveSpeaker = null;

        // If we're in LIVE_SPEAKER phase, transition back to ATTENTION_SELECTION
        if (tableState.phase === "LIVE_SPEAKER") {
          tableState.phase = "ATTENTION_SELECTION";
        }

        effects.push({
          type: "SOCKET_EMIT_ROOM",
          roomId: tableState.roomId,
          event: "live-speaker-cleared",
          data: {},
        });
      }

      // Check if we need to transition from ENDING back to active
      const connectedCount = Array.from(
        tableState.participants.values(),
      ).filter((p) => p.presence === "CONNECTED").length;

      if (tableState.phase === "ENDING" && connectedCount > 0) {
        console.log(
          `[V2 Reducer] 🔄 Transitioning from ENDING → ATTENTION_SELECTION (${connectedCount} connected)`,
        );
        tableState.phase = "ATTENTION_SELECTION";
      }

      console.log(
        `[V2 Reducer] ✅ ${ghost.displayName} reconnected | Fresh participation (role: listener)`,
      );

      effects.push(
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `${ghost.displayName} reconnected`,
          level: "info",
        },
        {
          type: "SOCKET_EMIT_USER",
          userId, // new socketId
          event: "v2:reconnect-state",
          data: {
            phase: tableState.phase,
            liveSpeaker: tableState.liveSpeaker
              ? (tableState.participants.get(tableState.liveSpeaker)
                  ?.displayName ?? null)
              : null,
          },
        },
        {
          type: "REBUILD_ALL_PANELS",
          roomId: tableState.roomId,
        },
      );

      // 🆕 Content Phase Feature: Check if we should start CONTENT_PHASE on reconnect
      const { FEATURE_CONTENT_PHASE } = require("../../config/featureFlags");

      if (
        FEATURE_CONTENT_PHASE &&
        tableState.phase === "LOBBY" &&
        !tableState.contentPhase &&
        !tableState.currentRound
      ) {
        const connectedCount = getConnectedParticipants(tableState).length;

        if (connectedCount >= 2) {
          console.log(
            `[V2 Reducer] 🚀 Starting Content Phase after reconnect (${connectedCount} users)`,
          );

          effects.push({
            type: "DELAYED_ACTION",
            roomId: tableState.roomId,
            delayMs: 500,
            action: {
              type: ActionTypes.START_CONTENT_PHASE,
            },
          });
        }
      }

      return effects;
    }

    case ActionTypes.PURGE_GHOST: {
      // =====================================================================
      // PURGE_GHOST: Delegate to handler
      // =====================================================================

      // Get userId from payload (not from dispatch parameter)
      const ghostUserId = action.payload?.userId;

      console.log(
        `[V2 Reducer] 🧹 PURGE_GHOST | Room: ${tableState.roomId} | User: ${ghostUserId ?? userId}`,
      );

      if (!ghostUserId) {
        console.error(`[V2 Reducer] ❌ PURGE_GHOST requires userId in payload`);
        return [];
      }

      return handlePurgeGhost(tableState, ghostUserId);
    }

    // ========================================================================
    // ATTENTION & CONSENSUS
    // ========================================================================

    case ActionTypes.POINT_TO_USER: {
      // =====================================================================
      // POINT_TO_USER: Update pointer map and check consensus
      // =====================================================================
      const { from: fromName, targetUserId: toName } = action.payload || {};

      // Resolve "from": try socketId first (passed as userId param), then display name
      const fromParticipant =
        (userId ? getParticipantBySocketId(tableState, userId) : null) ||
        (fromName ? findParticipantByDisplayName(tableState, fromName) : null);

      // Resolve "to": comes as display name from V1 protocol
      const toParticipant = toName
        ? findParticipantByDisplayName(tableState, toName) ||
          tableState.participants.get(toName)
        : null;

      if (!fromParticipant || !toParticipant) {
        console.warn(
          `[V2 Reducer] ⚠️ POINT_TO_USER could not resolve participants: ` +
            `from=${fromName || userId} → to=${toName} | ` +
            `participants=${Array.from(tableState.participants.values())
              .map((p) => p.displayName)
              .join(", ")}`,
        );
        return [];
      }

      // Update pointer in TableState
      tableState.pointerMap.set(fromParticipant.userId, toParticipant.userId);
      tableState.lastUpdated = Date.now();

      console.log(
        `[V2 Reducer] 👉 ${fromParticipant.displayName} → ${toParticipant.displayName} | ` +
          `pointerMap size: ${tableState.pointerMap.size}`,
      );

      const effects: Effect[] = [];

      // Check consensus after every pointer change
      const consensusUserId = evaluateConsensus(tableState);
      const connected = getConnectedParticipants(tableState);

      if (consensusUserId && consensusUserId !== tableState.liveSpeaker) {
        const speaker = tableState.participants.get(consensusUserId);

        // Transition to LIVE_SPEAKER
        tableState.liveSpeaker = consensusUserId;
        tableState.syncPause = false;
        tableState.phase = "LIVE_SPEAKER";

        // Set speaker role, reset all others to listener
        for (const [, p] of tableState.participants) {
          p.role = p.userId === consensusUserId ? "speaker" : "listener";
        }

        console.log(
          `[V2 Reducer] 🎤 Consensus! ${speaker?.displayName} goes LIVE | ` +
            `connected: ${connected.length}`,
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
      } else if (!consensusUserId && tableState.liveSpeaker !== null) {
        // Consensus was lost
        tableState.liveSpeaker = null;
        tableState.phase = "ATTENTION_SELECTION";
        for (const [, p] of tableState.participants) {
          if (p.role === "speaker") p.role = "listener";
        }
        effects.push({
          type: "SOCKET_EMIT_ROOM",
          roomId: tableState.roomId,
          event: "live-speaker-cleared",
          data: {},
        });
      }

      return effects;
    }

    case ActionTypes.CLICK_READY_TO_GLOW: {
      // =====================================================================
      // CLICK_READY_TO_GLOW: Start session, transition to picker mode
      // =====================================================================
      console.log(
        `[V2 Reducer] ✨ CLICK_READY_TO_GLOW | Room: ${tableState.roomId} | Session: ${tableState.sessionId} | User: ${userId}`,
      );

      if (!userId) {
        console.error(`[V2 Reducer] ❌ CLICK_READY_TO_GLOW requires userId`);
        return [];
      }

      const participant = tableState.participants.get(userId);

      if (!participant) {
        console.warn(
          `[V2 Reducer] ⚠️ CLICK_READY_TO_GLOW: User ${userId} not found`,
        );
        return [];
      }

      if (participant.presence !== "CONNECTED") {
        console.warn(
          `[V2 Reducer] ⚠️ CLICK_READY_TO_GLOW: User ${participant.displayName} is not CONNECTED (${participant.presence})`,
        );
        return [];
      }

      // Only allow from LOBBY phase
      if (tableState.phase !== "LOBBY") {
        console.warn(
          `[V2 Reducer] ⚠️ CLICK_READY_TO_GLOW: Cannot start session in phase ${tableState.phase}`,
        );
        return [];
      }

      // Transition to ATTENTION_SELECTION (picker mode)
      tableState.phase = "ATTENTION_SELECTION";

      // Start timer
      const durationMs = action.payload?.durationMinutes
        ? action.payload.durationMinutes * 60 * 1000
        : 60 * 60 * 1000; // Default 60 minutes

      tableState.timer = {
        active: true,
        startTime: Date.now(),
        durationMs,
        endTime: Date.now() + durationMs,
      };

      console.log(
        `[V2 Reducer] ✅ Session started by ${participant.displayName} | Phase: LOBBY → ATTENTION_SELECTION | Duration: ${durationMs / 60000} minutes`,
      );

      return [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `${participant.displayName} started the session`,
          level: "info",
        },
        {
          type: "SOCKET_EMIT_ROOM",
          roomId: tableState.roomId,
          event: "v2:session-started",
          data: {
            sessionId: tableState.sessionId,
            phase: tableState.phase,
            startedBy: participant.displayName,
            durationMinutes: durationMs / 60000,
            endTime: tableState.timer.endTime,
          },
        },
        {
          type: "TIMER_START",
          roomId: tableState.roomId,
          durationMs,
        },
      ];
    }

    case ActionTypes.EVALUATE_SYNC: {
      // =====================================================================
      // EVALUATE_SYNC: Re-check consensus on current pointer state
      // =====================================================================
      const consensusUserId = evaluateConsensus(tableState);

      if (!consensusUserId) {
        if (tableState.liveSpeaker !== null) {
          tableState.liveSpeaker = null;
          tableState.phase = "ATTENTION_SELECTION";
          return [
            {
              type: "SOCKET_EMIT_ROOM",
              roomId: tableState.roomId,
              event: "live-speaker-cleared",
              data: {},
            },
          ];
        }
        return [];
      }

      if (consensusUserId === tableState.liveSpeaker) return [];

      const speaker = tableState.participants.get(consensusUserId);
      tableState.liveSpeaker = consensusUserId;
      tableState.syncPause = false;
      tableState.phase = "LIVE_SPEAKER";

      console.log(
        `[V2 Reducer] 🎤 EVALUATE_SYNC → ${speaker?.displayName} LIVE`,
      );

      return [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `🎤 ${speaker?.displayName} is now live.`,
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
      ];
    }

    case ActionTypes.SET_LIVE_SPEAKER: {
      const targetUserId = action.payload?.userId;
      if (!targetUserId) return [];
      const speaker = tableState.participants.get(targetUserId);
      if (!speaker) return [];
      tableState.liveSpeaker = targetUserId;
      tableState.syncPause = false;
      console.log(`[V2 Reducer] 🎤 SET_LIVE_SPEAKER → ${speaker.displayName}`);
      return [
        {
          type: "SOCKET_EMIT_ROOM",
          roomId: tableState.roomId,
          event: "live-speaker",
          data: { name: speaker.displayName, userId: targetUserId },
        },
      ];
    }

    // ========================================================================
    // SPEAKING & MIC CONTROL
    // ========================================================================

    case ActionTypes.DROP_MIC: {
      // =====================================================================
      // DROP_MIC: Speaker releases mic, enter selection mode
      // =====================================================================
      console.log(
        `[V2 Reducer] 🎤 DROP_MIC | Room: ${tableState.roomId} | User: ${userId}`,
      );

      const dropper = userId
        ? getParticipantBySocketId(tableState, userId)
        : null;

      // Clear live speaker and all pointers
      tableState.liveSpeaker = null;
      tableState.syncPause = true;
      tableState.phase = "ATTENTION_SELECTION";
      tableState.pointerMap.clear();

      // Reset all roles to listener
      for (const [, p] of tableState.participants) {
        p.role = "listener";
      }

      console.log(
        `[V2 Reducer] ✅ Mic dropped by ${dropper?.displayName ?? userId} | Phase → ATTENTION_SELECTION | syncPause=true`,
      );

      return [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `${dropper?.displayName ?? "Speaker"} dropped the mic`,
          level: "info",
        },
        {
          type: "SOCKET_EMIT_ROOM",
          roomId: tableState.roomId,
          event: "live-speaker-cleared",
          data: {},
        },
        {
          type: "REBUILD_ALL_PANELS",
          roomId: tableState.roomId,
        },
      ];
    }

    case ActionTypes.PASS_MIC: {
      // =====================================================================
      // PASS_MIC: Speaker passes mic, enter selection mode
      // =====================================================================
      console.log(
        `[V2 Reducer] 🎤 PASS_MIC | Room: ${tableState.roomId} | User: ${userId}`,
      );

      const passer = userId
        ? getParticipantBySocketId(tableState, userId)
        : null;

      // Clear live speaker and all pointers
      tableState.liveSpeaker = null;
      tableState.syncPause = true;
      tableState.phase = "ATTENTION_SELECTION";
      tableState.pointerMap.clear();

      // Reset all roles to listener
      for (const [, p] of tableState.participants) {
        p.role = "listener";
      }

      console.log(
        `[V2 Reducer] ✅ Mic passed by ${passer?.displayName ?? userId} | Phase → ATTENTION_SELECTION | syncPause=true`,
      );

      return [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `${passer?.displayName ?? "Speaker"} is passing the mic`,
          level: "info",
        },
        {
          type: "SOCKET_EMIT_ROOM",
          roomId: tableState.roomId,
          event: "live-speaker-cleared",
          data: {},
        },
        {
          type: "REBUILD_ALL_PANELS",
          roomId: tableState.roomId,
        },
      ];
    }

    case ActionTypes.ACCEPT_MIC: {
      // =====================================================================
      // ACCEPT_MIC: User accepts offered mic, becomes live speaker
      // =====================================================================
      console.log(
        `[V2 Reducer] 🎤 ACCEPT_MIC | Room: ${tableState.roomId} | User: ${userId}`,
      );

      const accepter = userId
        ? getParticipantBySocketId(tableState, userId)
        : null;

      if (!accepter) {
        console.warn(`[V2 Reducer] ⚠️ ACCEPT_MIC: User ${userId} not found`);
        return [];
      }

      tableState.liveSpeaker = accepter.userId;
      tableState.syncPause = false;
      tableState.phase = "LIVE_SPEAKER";

      for (const [, p] of tableState.participants) {
        p.role = p.userId === accepter.userId ? "speaker" : "listener";
      }

      console.log(
        `[V2 Reducer] ✅ ${accepter.displayName} accepted mic | Phase → LIVE_SPEAKER`,
      );

      return [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `${accepter.displayName} accepted the mic`,
          level: "info",
        },
        {
          type: "SOCKET_EMIT_ROOM",
          roomId: tableState.roomId,
          event: "live-speaker",
          data: { name: accepter.displayName, userId: accepter.userId },
        },
        {
          type: "REBUILD_ALL_PANELS",
          roomId: tableState.roomId,
        },
      ];
    }

    case ActionTypes.DECLINE_MIC: {
      // =====================================================================
      // DECLINE_MIC: User declines offered mic, stay in selection
      // =====================================================================
      console.log(
        `[V2 Reducer] 🙅 DECLINE_MIC | Room: ${tableState.roomId} | User: ${userId}`,
      );

      const decliner = userId
        ? getParticipantBySocketId(tableState, userId)
        : null;

      // Clear any pointer this user had set
      if (decliner) {
        tableState.pointerMap.delete(decliner.userId);
      }

      console.log(
        `[V2 Reducer] ✅ ${decliner?.displayName ?? userId} declined mic | Phase stays ${tableState.phase}`,
      );

      return [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `${decliner?.displayName ?? "User"} declined the mic`,
          level: "info",
        },
        {
          type: "REBUILD_ALL_PANELS",
          roomId: tableState.roomId,
        },
      ];
    }

    // ========================================================================
    // GESTURES & COMMUNICATION
    // ========================================================================

    case ActionTypes.SEND_GESTURE:
      // return transitions.sendGesture(tableState, userId!, action.payload);
      console.warn(`[reducer] ${action.type} not yet implemented`);
      return [];

    case ActionTypes.TEXT_INPUT:
      // return transitions.textInput(tableState, userId!, action.payload);
      console.warn(`[reducer] ${action.type} not yet implemented`);
      return [];

    // ========================================================================
    // TIMER & SESSION END
    // ========================================================================

    case ActionTypes.TIMER_EXPIRED: {
      // =====================================================================
      // TIMER_EXPIRED: Session timer hit, transition to ENDING phase
      // =====================================================================
      console.log(
        `[V2 Reducer] ⏰ TIMER_EXPIRED | Room: ${tableState.roomId} | Session: ${tableState.sessionId} | Phase: ${tableState.phase}`,
      );

      // Transition to ENDING phase (30-second grace period)
      tableState.phase = "ENDING";

      // Clear live speaker — ENDING requires liveSpeaker = null (Invariant 14)
      if (tableState.liveSpeaker) {
        const speaker = tableState.participants.get(tableState.liveSpeaker);
        if (speaker) speaker.role = "listener";
        tableState.liveSpeaker = null;
      }

      // Update timer state
      tableState.timer.active = false;

      return [
        {
          type: "TIMER_CANCEL",
          roomId: tableState.roomId,
        },
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `Session timer expired. Entering grace period.`,
          level: "warn",
        },
        {
          type: "SOCKET_EMIT_ROOM",
          roomId: tableState.roomId,
          event: "v2:session-ending",
          data: {
            sessionId: tableState.sessionId,
            gracePeriodMs: 30000,
            participantCount: tableState.participants.size,
          },
        },
        {
          type: "DELAYED_ACTION",
          roomId: tableState.roomId,
          delayMs: 30000,
          action: { type: ActionTypes.END_SESSION },
        },
      ];
    }

    case ActionTypes.END_SESSION: {
      // =====================================================================
      // END_SESSION: Grace period expired, finalize session
      // =====================================================================
      console.log(
        `[V2 Reducer] 🔚 END_SESSION | Room: ${tableState.roomId} | Session: ${tableState.sessionId}`,
      );

      // Transition to ENDED phase
      tableState.phase = "ENDED";

      // Clear speaker
      if (tableState.liveSpeaker) {
        const speaker = tableState.participants.get(tableState.liveSpeaker);
        if (speaker) {
          speaker.role = "listener";
        }
        tableState.liveSpeaker = null;
      }

      // Stop any timers
      tableState.timer.active = false;

      return [
        {
          type: "TIMER_CANCEL",
          roomId: tableState.roomId,
        },
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `Session ended. Participants: ${tableState.participants.size}`,
          level: "info",
        },
        {
          type: "SOCKET_EMIT_ROOM",
          roomId: tableState.roomId,
          event: "v2:session-ended",
          data: {
            sessionId: tableState.sessionId,
            participantCount: tableState.participants.size,
            reason: "natural-end",
          },
        },
        {
          type: "SCHEDULE_CLEANUP",
          roomId: tableState.roomId,
          delayMs: 60000, // 1 minute before cleanup
        },
      ];
    }

    case ActionTypes.ADMIN_END_SESSION: {
      // =====================================================================
      // ADMIN_END_SESSION: Admin manually terminates session
      // =====================================================================
      const { adminId } = action.payload || {};

      console.log(
        `[V2 Reducer] 🛑 ADMIN_END_SESSION | Room: ${tableState.roomId} | Session: ${tableState.sessionId} | Admin: ${adminId}`,
      );

      // Immediately transition to ENDED phase (no grace period)
      tableState.phase = "ENDED";

      // Clear speaker
      if (tableState.liveSpeaker) {
        const speaker = tableState.participants.get(tableState.liveSpeaker);
        if (speaker) {
          speaker.role = "listener";
        }
        tableState.liveSpeaker = null;
      }

      // Stop any timers
      tableState.timer.active = false;

      return [
        {
          type: "TIMER_CANCEL",
          roomId: tableState.roomId,
        },
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `Session terminated by admin ${adminId || "unknown"}`,
          level: "warn",
        },
        {
          type: "SOCKET_EMIT_ROOM",
          roomId: tableState.roomId,
          event: "v2:session-ended",
          data: {
            sessionId: tableState.sessionId,
            participantCount: tableState.participants.size,
            reason: "admin-terminated",
            adminId,
          },
        },
        {
          type: "SCHEDULE_CLEANUP",
          roomId: tableState.roomId,
          delayMs: 10000, // 10 seconds before cleanup (fast)
        },
      ];
    }

    // ========================================================================
    // CONTENT PHASE & ROUNDS (🆕 Feature)
    // ========================================================================

    case ActionTypes.START_CONTENT_PHASE: {
      console.log(
        `[V2 Reducer] 📖 START_CONTENT_PHASE | Room: ${tableState.roomId}`,
      );

      // Abort if the session is already winding down (all users left during
      // the delay window). Prevents invariant violations from stale timers.
      if (
        tableState.phase === "ENDING" ||
        tableState.phase === "ENDED" ||
        getConnectedParticipants(tableState).length === 0
      ) {
        console.log(
          `[V2 Reducer] ⏸️ START_CONTENT_PHASE aborted — session is ending or no connected users`,
        );
        return [];
      }

      // Guard: if a round is still active (delayed action from handleLeaveSession),
      // re-validate that all current users are ready before proceeding.
      // Bug A: round active + all ready → end round, then continue.
      // Bug C: round active + NOT all ready (new joiner arrived in delay window) → abort.
      let roundEndedHere = false;
      if (
        tableState.currentRound &&
        tableState.currentRound.status === "active"
      ) {
        if (!allUsersReady(tableState.currentRound, tableState.participants)) {
          console.log(
            `[V2 Reducer] ⏸️ START_CONTENT_PHASE aborted — new joiner arrived during delay, not all users ready`,
          );
          return [];
        }
        // All current users are ready — end the round and clear it so the
        // client hides the readiness row before the content phase begins.
        endRound(tableState.currentRound);
        tableState.roundsHistory.push(tableState.currentRound);
        tableState.currentRound = null;
        roundEndedHere = true;
        console.log(
          `[V2 Reducer] ✅ Round ended by START_CONTENT_PHASE (solo-ready path)`,
        );
      }

      // 🆕 CRITICAL: Use tableId, not roomId, for content lookup
      const tableDefinition = getTableDefinition(tableState.tableId);

      if (!tableDefinition || !tableDefinition.content) {
        console.error(
          `[V2 Reducer] ❌ No table definition or content config for table: ${tableState.tableId}`,
        );
        tableState.phase = "ENDED";
        return [];
      }

      const themeKey = tableDefinition.content.themeKey;
      const tableSubjects = tableDefinition.content.subjects;

      console.log(
        `[V2 Reducer] Content Phase for table '${tableDefinition.name}' with theme '${themeKey}' and ${tableSubjects.length} subjects`,
      );

      const targetRoundNumber = (tableState.roundsHistory?.length || 0) + 1;

      tableState.phase = "CONTENT_PHASE";
      tableState.contentPhase = createContentPhaseState(
        themeKey,
        targetRoundNumber,
      );

      const contentPhaseEffects: Effect[] = [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `Content Phase started - choose the direction of the circle`,
          level: "info",
        },
        {
          type: "REBUILD_ALL_PANELS",
          roomId: tableState.roomId,
        },
      ];

      // If we just ended a round here, tell clients so the readiness row clears
      if (roundEndedHere) {
        contentPhaseEffects.unshift({
          type: "EMIT_ROUND_STATE",
          roomId: tableState.roomId,
        });
      }

      return contentPhaseEffects;
    }

    case ActionTypes.VOTE_CONTENT_SUBJECT: {
      console.log(
        `[V2 Reducer] 🗳️ VOTE_CONTENT_SUBJECT | Room: ${tableState.roomId} | User: ${userId}`,
      );

      if (!userId) {
        console.error(`[V2 Reducer] ❌ VOTE_CONTENT_SUBJECT requires userId`);
        return [];
      }

      if (!tableState.contentPhase || tableState.phase !== "CONTENT_PHASE") {
        console.error(`[V2 Reducer] ❌ Not in CONTENT_PHASE`);
        return [];
      }

      const { subjectKey } = action.payload || {};

      if (!subjectKey) {
        console.error(
          `[V2 Reducer] ❌ VOTE_CONTENT_SUBJECT missing subjectKey`,
        );
        return [];
      }

      // 🆕 CRITICAL: Pass tableId for table-based validation
      castVote(tableState.contentPhase, userId, subjectKey, tableState.tableId);

      const effects: Effect[] = [
        {
          type: "REBUILD_ALL_PANELS",
          roomId: tableState.roomId,
        },
      ];

      // Check if all users have voted
      if (allUsersVoted(tableState.contentPhase, tableState.participants)) {
        console.log(`[V2 Reducer] ✅ All users voted, resolving...`);

        effects.push({
          type: "DELAYED_ACTION",
          roomId: tableState.roomId,
          delayMs: 1000,
          action: {
            type: ActionTypes.RESOLVE_CONTENT_PHASE,
          },
        });
      }

      return effects;
    }

    case ActionTypes.RESOLVE_CONTENT_PHASE: {
      console.log(
        `[V2 Reducer] 🎯 RESOLVE_CONTENT_PHASE | Room: ${tableState.roomId}`,
      );

      if (!tableState.contentPhase) {
        console.error(`[V2 Reducer] ❌ No content phase to resolve`);
        return [];
      }

      // Re-validate: a new participant may have joined during the delay window
      // (e.g. Alice voted, Bob left triggering a delayed resolve, Charlie joined
      // in the 1000ms gap and hasn't voted yet). If consensus no longer holds,
      // abort — the phase stays open until Charlie votes.
      if (!allUsersVoted(tableState.contentPhase, tableState.participants)) {
        console.log(
          `[V2 Reducer] ⏸️ RESOLVE_CONTENT_PHASE aborted — not all connected users have voted (participant set changed during delay)`,
        );
        return [];
      }

      const winningSubject = resolveVotes(tableState.contentPhase);

      if (!winningSubject) {
        console.error(`[V2 Reducer] ❌ No votes to resolve`);
        return [];
      }

      // Get random question from winning subject
      const questionData = contentConfigLoader.getRandomQuestion(
        tableState.contentPhase.tableThemeKey,
        winningSubject,
      );

      if (!questionData) {
        console.error(
          `[V2 Reducer] ❌ Failed to get question for subject: ${winningSubject}`,
        );
        return [];
      }

      // Mark as resolved and store results
      tableState.contentPhase.status = "resolved";
      tableState.contentPhase.selectedSubjectKey = winningSubject;
      tableState.contentPhase.selectedQuestionId = questionData.id;
      tableState.contentPhase.selectedQuestionText = questionData.text;

      console.log(
        `[V2 Reducer] ✅ Resolved: ${winningSubject} | Question: "${questionData.text}"`,
      );

      return [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `Circle chose: ${winningSubject}`,
          level: "info",
        },
        {
          type: "REBUILD_ALL_PANELS",
          roomId: tableState.roomId,
        },
        {
          type: "DELAYED_ACTION",
          roomId: tableState.roomId,
          delayMs: 1500,
          action: {
            type: ActionTypes.START_ROUND,
            payload: {
              tableThemeKey: tableState.contentPhase.tableThemeKey,
              subjectKey: winningSubject,
              questionId: questionData.id,
              glyphText: questionData.text,
            },
          },
        },
      ];
    }

    case ActionTypes.START_ROUND: {
      console.log(`[V2 Reducer] 🔥 START_ROUND | Room: ${tableState.roomId}`);

      if (
        !tableState.contentPhase ||
        tableState.contentPhase.status !== "resolved"
      ) {
        console.error(`[V2 Reducer] ❌ Content phase not resolved`);
        return [];
      }

      const { tableThemeKey, subjectKey, questionId, glyphText } =
        action.payload || {};

      if (!tableThemeKey || !subjectKey || !questionId || !glyphText) {
        console.error(`[V2 Reducer] ❌ START_ROUND missing required fields`);
        return [];
      }

      // Calculate round number
      const roundNumber = (tableState.roundsHistory?.length || 0) + 1;

      // Create new round (includes Glyph)
      const newRound = createRound({
        roundNumber,
        tableThemeKey,
        subjectKey,
        questionId,
        glyphText,
      });

      // Set as current round
      tableState.currentRound = newRound;

      // Clear content phase
      tableState.contentPhase = null;

      // Transition to ATTENTION_SELECTION
      tableState.phase = "ATTENTION_SELECTION";

      console.log(
        `[V2 Reducer] ✅ Round ${roundNumber} started: "${glyphText}"`,
      );

      return [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `Round ${roundNumber} begins`,
          level: "info",
        },
        // 🧹 Clear previous round's gliff log
        {
          type: "CLEAR_GLIFF",
          roomId: tableState.roomId,
        },
        // 🆕 Emit question to GliffLog as first entry of round
        {
          type: "GLIFF_APPEND",
          roomId: tableState.roomId,
          entry: {
            userName: "", // No author for context messages
            message: {
              messageType: "context",
              content: glyphText,
              timestamp: Date.now(),
            },
          },
        },
        {
          type: "REBUILD_ALL_PANELS",
          roomId: tableState.roomId,
        },
        {
          type: "EMIT_ROUND_STATE",
          roomId: tableState.roomId,
        },
        // 🆕 ISSUE 6 FIX: Emit initial readiness state (0 / X ready)
        {
          type: "EMIT_READINESS_UPDATE",
          roomId: tableState.roomId,
        },
      ];
    }

    case ActionTypes.ROUND_MARK_READY: {
      console.log(
        `[V2 Reducer] ✋ ROUND_MARK_READY | Room: ${tableState.roomId} | User: ${userId}`,
      );

      if (!userId) {
        console.error(`[V2 Reducer] ❌ ROUND_MARK_READY requires userId`);
        return [];
      }

      if (!tableState.currentRound) {
        console.error(`[V2 Reducer] ❌ No active round`);
        return [];
      }

      const changed = markUserReady(tableState.currentRound, userId);

      if (!changed) {
        return []; // User was already ready
      }

      const effects: Effect[] = [
        {
          type: "EMIT_READINESS_UPDATE",
          roomId: tableState.roomId,
        },
      ];

      // Check if all users are ready (unanimous consensus)
      if (allUsersReady(tableState.currentRound, tableState.participants)) {
        console.log(
          `[V2 Reducer] 🎉 All users ready - ending round, starting new content phase`,
        );

        // End current round
        endRound(tableState.currentRound);

        // Move to history
        tableState.roundsHistory.push(tableState.currentRound);
        tableState.currentRound = null;

        // Tell clients the round ended (roundData → null → hides readiness indicator)
        effects.push({
          type: "EMIT_ROUND_STATE",
          roomId: tableState.roomId,
        });

        // Start new content phase (reads theme from table definition)
        effects.push({
          type: "DELAYED_ACTION",
          roomId: tableState.roomId,
          delayMs: 1500,
          action: {
            type: ActionTypes.START_CONTENT_PHASE,
          },
        });
      }

      return effects;
    }

    case ActionTypes.ROUND_UNMARK_READY: {
      console.log(
        `[V2 Reducer] 🤚 ROUND_UNMARK_READY | Room: ${tableState.roomId} | User: ${userId}`,
      );

      if (!userId) {
        console.error(`[V2 Reducer] ❌ ROUND_UNMARK_READY requires userId`);
        return [];
      }

      if (!tableState.currentRound) {
        console.error(`[V2 Reducer] ❌ No active round`);
        return [];
      }

      const changed = unmarkUserReady(tableState.currentRound, userId);

      if (!changed) {
        return []; // User was not ready
      }

      return [
        {
          type: "EMIT_READINESS_UPDATE",
          roomId: tableState.roomId,
        },
      ];
    }

    // ========================================================================
    // SYSTEM ACTIONS
    // ========================================================================

    case ActionTypes.NO_OP:
      // No-op action for testing
      return [];

    // ========================================================================
    // UNKNOWN ACTION
    // ========================================================================

    default:
      console.error(`[reducer] Unknown action type: ${action.type}`);
      return [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `Unknown action: ${action.type}`,
          level: "error",
        },
      ];
  }
}

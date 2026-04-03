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
import { createParticipantState } from "../state/defaults";

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

      // Check avatar availability
      for (const [, participant] of tableState.participants) {
        if (
          participant.avatarId === avatarId &&
          participant.presence !== "LEFT"
        ) {
          console.warn(
            `[V2 Reducer] ⚠️ Avatar ${avatarId} already taken by ${participant.displayName}`,
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

      return [
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
    }

    case ActionTypes.LEAVE_SESSION:
      // return transitions.leave(tableState, userId!);
      console.warn(`[reducer] ${action.type} not yet implemented`);
      return [];

    case ActionTypes.DISCONNECT: {
      // =====================================================================
      // DISCONNECT: Set user to GHOST (preserve seat)
      // =====================================================================
      console.log(
        `[V2 Reducer] 👻 DISCONNECT | Room: ${tableState.roomId} | Session: ${tableState.sessionId} | User: ${userId}`,
      );

      if (!userId) {
        console.error(`[V2 Reducer] ❌ DISCONNECT requires userId`);
        return [];
      }

      const participant = tableState.participants.get(userId);

      if (!participant) {
        console.warn(
          `[V2 Reducer] ⚠️ DISCONNECT: User ${userId} not found in participants`,
        );
        return [];
      }

      // Set to GHOST (don't remove from participants)
      participant.presence = "GHOST";
      participant.socketId = null;
      participant.lastSeen = Date.now();

      const effects: Effect[] = [];

      // Check if this was the live speaker
      if (tableState.liveSpeaker === userId) {
        console.log(
          `[V2 Reducer] 🎤 Speaker ${participant.displayName} went ghost`,
        );

        // Check if ALL users are now ghosts
        const connectedCount = Array.from(
          tableState.participants.values(),
        ).filter((p) => p.presence === "CONNECTED").length;

        if (connectedCount === 0) {
          console.log(
            `[V2 Reducer] 💤 All users are ghosts, clearing speaker and staying in phase`,
          );
          tableState.liveSpeaker = null;
          participant.role = "listener";

          effects.push({
            type: "SYSTEM_LOG",
            roomId: tableState.roomId,
            message: `All users disconnected. Session paused.`,
            level: "warn",
          });
        } else {
          console.log(
            `[V2 Reducer] 🎤 Speaker kept mic while ghost (${connectedCount} users still connected)`,
          );
          effects.push({
            type: "SYSTEM_LOG",
            roomId: tableState.roomId,
            message: `${participant.displayName} disconnected but holding mic`,
            level: "info",
          });
        }
      }

      console.log(
        `[V2 Reducer] ✅ ${participant.displayName} → GHOST | Connected: ${Array.from(tableState.participants.values()).filter((p) => p.presence === "CONNECTED").length} | Ghosts: ${Array.from(tableState.participants.values()).filter((p) => p.presence === "GHOST").length}`,
      );

      effects.push({
        type: "SOCKET_EMIT_ROOM",
        roomId: tableState.roomId,
        event: "v2:user-ghosted",
        data: {
          userId,
          displayName: participant.displayName,
        },
      });

      return effects;
    }

    case ActionTypes.RECONNECT:
      // return transitions.reconnect(tableState, userId!, action.payload);
      console.warn(`[reducer] ${action.type} not yet implemented`);
      return [];

    // ========================================================================
    // ATTENTION & CONSENSUS
    // ========================================================================

    case ActionTypes.POINT_TO_USER:
      // return transitions.pointToUser(tableState, userId!, action.payload);
      console.warn(`[reducer] ${action.type} not yet implemented`);
      return [];

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

    case ActionTypes.EVALUATE_SYNC:
      // return transitions.evaluateSync(tableState);
      console.warn(`[reducer] ${action.type} not yet implemented`);
      return [];

    case ActionTypes.SET_LIVE_SPEAKER:
      // return transitions.setLiveSpeaker(tableState, action.payload.userId);
      console.warn(`[reducer] ${action.type} not yet implemented`);
      return [];

    // ========================================================================
    // SPEAKING & MIC CONTROL
    // ========================================================================

    case ActionTypes.DROP_MIC:
      // return transitions.dropMic(tableState, userId!);
      console.warn(`[reducer] ${action.type} not yet implemented`);
      return [];

    case ActionTypes.PASS_MIC:
      // return transitions.passMic(tableState, userId!, action.payload);
      console.warn(`[reducer] ${action.type} not yet implemented`);
      return [];

    case ActionTypes.ACCEPT_MIC:
      // return transitions.acceptMic(tableState, userId!);
      console.warn(`[reducer] ${action.type} not yet implemented`);
      return [];

    case ActionTypes.DECLINE_MIC:
      // return transitions.declineMic(tableState, userId!);
      console.warn(`[reducer] ${action.type} not yet implemented`);
      return [];

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

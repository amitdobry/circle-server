/**
 * Engine V2: Effect Runner
 *
 * Executes side effects produced by the reducer.
 * Effects are plain objects (not functions), so this module
 * interprets them and performs the actual side effects.
 *
 * CRITICAL: This module CANNOT mutate TableState.
 * It can only trigger external side effects (socket emits, timers, etc.)
 */

import { Server, Socket } from "socket.io";
import { Effect } from "../state/types";
import { dispatch } from "../reducer/dispatch";

// ============================================================================
// TIMER MANAGEMENT
// ============================================================================

/**
 * Active session timers (roomId -> NodeJS.Timeout)
 */
const sessionTimers = new Map<string, NodeJS.Timeout>();

/**
 * Active delayed action timers (roomId -> NodeJS.Timeout)
 */
const delayedActionTimers = new Map<string, NodeJS.Timeout>();

/**
 * Active cleanup timers (roomId -> NodeJS.Timeout)
 */
const cleanupTimers = new Map<string, NodeJS.Timeout>();

/**
 * Start a session timer that dispatches TIMER_EXPIRED when done
 */
function startSessionTimer(
  roomId: string,
  durationMs: number,
  io: Server,
): void {
  // Cancel existing timer for this room
  cancelSessionTimer(roomId);

  console.log(`[Timer] Starting ${durationMs}ms timer for room ${roomId}`);

  const timer = setTimeout(() => {
    console.log(`[Timer] ⏰ Timer expired for room ${roomId}`);

    // Dispatch TIMER_EXPIRED action to V2
    const effects = dispatch(roomId, null, {
      type: "TIMER_EXPIRED",
      payload: {},
    });

    // Run resulting effects
    runEffects(effects, io);
  }, durationMs);

  sessionTimers.set(roomId, timer);
}

/**
 * Cancel a session timer
 */
function cancelSessionTimer(roomId: string): void {
  const timer = sessionTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    sessionTimers.delete(roomId);
    console.log(`[Timer] Cancelled timer for room ${roomId}`);
  }
}

/**
 * Schedule a delayed action dispatch
 */
function scheduleDelayedAction(
  roomId: string,
  delayMs: number,
  action: any,
  io: Server,
): void {
  // For ghost-related actions, use composite key to allow multiple independent timers per room
  const userId = action.payload?.userId;
  const timerKey = userId ? `${roomId}:${userId}` : roomId;

  // Cancel existing delayed action for this specific key (not the whole room)
  cancelDelayedAction(timerKey);

  console.log(
    `[DelayedAction] Scheduling ${action.type} in ${delayMs}ms for ${timerKey}`,
  );

  const timer = setTimeout(() => {
    console.log(`[DelayedAction] 🕐 Executing ${action.type} for ${timerKey}`);

    // Dispatch the delayed action
    const effects = dispatch(roomId, userId, action);

    // Run resulting effects
    runEffects(effects, io);

    // ✅ FIX: After PURGE_GHOST, trigger user list and avatar broadcasts
    // This is needed because PURGE_GHOST removes participant from V2,
    // and avatarManager checks V2 ghosts to lock avatars
    if (action.type === "PURGE_GHOST") {
      console.log(
        `[DelayedAction] Ghost purged, triggering broadcasts for room ${roomId}`,
      );

      // Emit user-list update to room (includes remaining ghosts + connected users)
      const { roomRegistry } = require("../registry/RoomRegistry");
      const roomState = roomRegistry.getRoom(roomId);

      if (roomState && roomState.participants.size > 0) {
        const roomUsers = Array.from(roomState.participants.values()).map(
          (participant: any) => ({
            name: participant.displayName,
            avatarId: participant.avatarId,
            state: participant.presence === "GHOST" ? "ghost" : "regular",
            presence: participant.presence,
            interruptedBy: "",
            joinedAt: new Date(participant.lastSeen || Date.now()),
            lastActivity: new Date(participant.lastSeen || Date.now()),
          }),
        );

        io.to(roomId).emit("user-list", roomUsers);
        console.log(
          `[DelayedAction] Broadcast ${roomUsers.length} users to room ${roomId}`,
        );
      }

      // Broadcast updated avatar state (purged ghost's avatar is now available)
      const { getAvailableAvatars } = require("../../avatarManager");
      const roomAvatars = getAvailableAvatars(roomId);
      io.to(roomId).emit("avatars", roomAvatars);
      console.log(
        `[DelayedAction] Broadcast ${roomAvatars.length} avatars to room ${roomId}`,
      );
    }
  }, delayMs);

  delayedActionTimers.set(timerKey, timer);
}

/**
 * Cancel a delayed action by timer key (roomId or roomId:userId)
 */
function cancelDelayedAction(timerKey: string): void {
  const timer = delayedActionTimers.get(timerKey);
  if (timer) {
    clearTimeout(timer);
    delayedActionTimers.delete(timerKey);
    console.log(`[DelayedAction] Cancelled delayed action: ${timerKey}`);
  }
}

/**
 * Cancel all delayed actions for a specific room
 * Used during room cleanup to prevent orphaned timers
 */
function cancelAllDelayedActionsForRoom(roomId: string): void {
  let cancelledCount = 0;

  // Iterate all timer keys and cancel those belonging to this room
  for (const [timerKey, timer] of delayedActionTimers.entries()) {
    // Match both "roomId" and "roomId:userId" patterns
    if (timerKey === roomId || timerKey.startsWith(`${roomId}:`)) {
      clearTimeout(timer);
      delayedActionTimers.delete(timerKey);
      cancelledCount++;
      console.log(
        `[DelayedAction] Cancelled timer for room cleanup: ${timerKey}`,
      );
    }
  }

  if (cancelledCount > 0) {
    console.log(
      `[DelayedAction] Cancelled ${cancelledCount} delayed action(s) for room ${roomId}`,
    );
  }
}

/**
 * Schedule room cleanup
 */
function scheduleCleanup(roomId: string, delayMs: number, io: Server): void {
  // Cancel existing cleanup timer
  cancelCleanup(roomId);

  console.log(
    `[Cleanup] Scheduling cleanup in ${delayMs}ms for room ${roomId}`,
  );

  const timer = setTimeout(() => {
    console.log(`[Cleanup] 🧹 Executing cleanup for room ${roomId}`);

    // Dispatch EXECUTE_CLEANUP effect
    runEffects(
      [
        {
          type: "EXECUTE_CLEANUP",
          roomId,
        },
      ],
      io,
    );
  }, delayMs);

  cleanupTimers.set(roomId, timer);
}

/**
 * Cancel scheduled cleanup
 */
function cancelCleanup(roomId: string): void {
  const timer = cleanupTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    cleanupTimers.delete(roomId);
    console.log(`[Cleanup] Cancelled cleanup for room ${roomId}`);
  }
}

// ============================================================================
// EFFECT RUNNER
// ============================================================================

/**
 * Execute a list of effects.
 *
 * @param effects - Array of effect objects to execute
 * @param io - Socket.IO server instance
 */
export function runEffects(effects: Effect[], io: Server): void {
  for (const effect of effects) {
    try {
      executeEffect(effect, io);
    } catch (error) {
      console.error(
        "[runEffects] Effect execution failed:",
        effect.type,
        error,
      );
    }
  }
}

/**
 * Execute a single effect.
 */
function executeEffect(effect: Effect, io: Server): void {
  switch (effect.type) {
    // ========================================================================
    // SOCKET EMISSIONS
    // ========================================================================

    case "SOCKET_EMIT_ROOM":
      // Emit to all sockets in a room
      io.to(effect.roomId).emit(effect.event, effect.data);
      break;

    case "SOCKET_EMIT_USER":
      // userId in V2 = socketId (socket.id passed as userId throughout shadow dispatch)
      if (effect.userId) {
        io.to(effect.userId).emit(effect.event, effect.data);
        console.log(
          `[runEffects] SOCKET_EMIT_USER → ${effect.userId} | event: ${effect.event}`,
        );
      } else {
        console.warn("[runEffects] SOCKET_EMIT_USER: missing userId");
      }
      break;

    case "EMIT_FULL_STATE_TO_USER": {
      // Send phase + speaker state to a reconnecting user
      if (effect.userId && effect.snapshot) {
        io.to(effect.userId).emit("v2:full-state", effect.snapshot);
        console.log(`[runEffects] EMIT_FULL_STATE_TO_USER → ${effect.userId}`);
      } else {
        console.warn(
          "[runEffects] EMIT_FULL_STATE_TO_USER: missing userId or snapshot",
        );
      }
      break;
    }

    case "EMIT_PANEL_CONFIG": {
      // Send a pre-built panel config to a specific user
      if (effect.userId && effect.config) {
        io.to(effect.userId).emit("receive:panelConfig", effect.config);
        console.log(`[runEffects] EMIT_PANEL_CONFIG → ${effect.userId}`);
      } else {
        console.warn(
          "[runEffects] EMIT_PANEL_CONFIG: missing userId or config",
        );
      }
      break;
    }

    // ========================================================================
    // GLIFF LOG
    // ========================================================================

    case "GLIFF_APPEND":
      // Append to gliff log (conversation log)
      console.warn(
        "[runEffects] GLIFF_APPEND not yet implemented:",
        effect.roomId,
      );
      // TODO: Integrate with gliffService
      break;

    // ========================================================================
    // TIMER
    // ========================================================================

    case "TIMER_START":
      // Start session timer
      startSessionTimer(effect.roomId, effect.durationMs, io);
      console.log(
        `[runEffects] TIMER_START: ${effect.durationMs}ms for room ${effect.roomId}`,
      );
      break;

    case "TIMER_CANCEL":
      // Cancel session timer
      cancelSessionTimer(effect.roomId);
      console.log(`[runEffects] TIMER_CANCEL: room ${effect.roomId}`);
      break;

    // ========================================================================
    // SYSTEM LOGGING
    // ========================================================================

    case "SYSTEM_LOG":
      // Log system message
      const level = effect.level || "info";
      const prefix = `[Room ${effect.roomId}]`;

      if (level === "error") {
        console.error(prefix, effect.message);
      } else if (level === "warn") {
        console.warn(prefix, effect.message);
      } else {
        console.log(prefix, effect.message);
      }

      // Also emit to room for client-side display
      io.to(effect.roomId).emit("system-message", {
        message: effect.message,
        timestamp: Date.now(),
      });
      break;

    // ========================================================================
    // DELAYED ACTIONS
    // ========================================================================

    case "DELAYED_ACTION":
      // Schedule a future dispatch
      scheduleDelayedAction(effect.roomId, effect.delayMs, effect.action, io);
      console.log(
        `[runEffects] DELAYED_ACTION: ${effect.action.type} in ${effect.delayMs}ms for room ${effect.roomId}`,
      );
      break;

    // ========================================================================
    // ROOM LIFECYCLE
    // ========================================================================

    case "SCHEDULE_CLEANUP":
      // Schedule room cleanup after delay
      scheduleCleanup(effect.roomId, effect.delayMs, io);
      console.log(
        `[runEffects] SCHEDULE_CLEANUP: ${effect.delayMs}ms for room ${effect.roomId}`,
      );
      break;

    case "EXECUTE_CLEANUP":
      // Immediately cleanup room
      console.log(
        `[runEffects] EXECUTE_CLEANUP: Removing room ${effect.roomId}`,
      );

      // Import roomRegistry to delete the room
      const { roomRegistry } = require("../registry/RoomRegistry");
      roomRegistry.destroyRoom(effect.roomId);

      // Clear all timers for this room
      cancelSessionTimer(effect.roomId);
      cancelAllDelayedActionsForRoom(effect.roomId); // Cancel ALL delayed actions (ghosts, etc.)
      cancelCleanup(effect.roomId);

      console.log(
        `[runEffects] ✅ Room ${effect.roomId} cleaned up and deleted`,
      );
      break;

    case "CANCEL_CLEANUP":
      // Cancel scheduled cleanup
      cancelCleanup(effect.roomId);
      console.log(`[runEffects] CANCEL_CLEANUP: room ${effect.roomId}`);
      break;

    // ========================================================================
    // PANEL REBUILD
    // ========================================================================

    case "REBUILD_ALL_PANELS": {
      // V2 panel snapshot — compare against [PANEL-SNAPSHOT][V1] to detect override races
      const { roomRegistry } = require("../registry/RoomRegistry");
      const { getPanelConfigFor } = require("../../panelConfigService");
      const tableState = roomRegistry.getRoom(effect.roomId);
      if (tableState) {
        const pointerEntries =
          Array.from((tableState.pointerMap as Map<string, string>).entries())
            .map(([k, v]) => `${k}→${v}`)
            .join(", ") || "(empty)";
        const connected =
          Array.from((tableState.participants as Map<string, any>).values())
            .filter((p) => p.presence === "CONNECTED")
            .map((p) => p.displayName)
            .join(", ") || "(none)";
        console.log(
          `[PANEL-SNAPSHOT][V2] room=${effect.roomId} phase=${tableState.phase} liveSpeaker=${
            tableState.liveSpeaker ?? "none"
          } connected=[${connected}] pointerMap={${pointerEntries}}`,
        );

        // Sync V2 liveSpeaker into SpeakerManager so panelConfigService reads the correct value
        const { setLiveSpeaker } = require("../../socketHandler");
        const speakerUserId = tableState.liveSpeaker as string | null;
        let syncedSpeakerName: string | null = null;

        console.log(
          `[REBUILD_ALL_PANELS] 🔍 Looking for speaker with userId: ${speakerUserId ?? "none"}`,
        );

        if (speakerUserId) {
          for (const [, p] of tableState.participants as Map<string, any>) {
            if (p.userId === speakerUserId) {
              syncedSpeakerName = p.displayName;
              console.log(
                `[REBUILD_ALL_PANELS] ✅ Found speaker: ${p.displayName} (userId: ${p.userId})`,
              );
              break;
            }
          }

          if (!syncedSpeakerName) {
            console.warn(
              `[REBUILD_ALL_PANELS] ⚠️ Speaker userId ${speakerUserId} not found in participants`,
            );
          }
        }

        setLiveSpeaker(syncedSpeakerName, effect.roomId);
        console.log(
          `[REBUILD_ALL_PANELS] Synced liveSpeaker → ${syncedSpeakerName ?? "none"} in room ${effect.roomId}`,
        );

        // ✅ Emit panel configs to all connected users
        let emitCount = 0;
        for (const [, participant] of tableState.participants as Map<
          string,
          any
        >) {
          if (participant.presence !== "CONNECTED" || !participant.socketId)
            continue;
          try {
            // ✅ FIX: Pass roomId so panel uses correct liveSpeaker and context
            const config = getPanelConfigFor(
              participant.displayName,
              effect.roomId,
            );
            io.to(participant.socketId).emit("receive:panelConfig", config);
            console.log(
              `[REBUILD_ALL_PANELS] ✅ Sent panel to ${participant.displayName} (${participant.socketId})`,
            );
            emitCount++;
          } catch (err) {
            console.error(
              `[REBUILD_ALL_PANELS] ❌ Failed panel for ${participant.displayName}:`,
              err,
            );
          }
        }
        console.log(
          `[REBUILD_ALL_PANELS] Done — emitted to ${emitCount} user(s) in room ${effect.roomId}`,
        );
      } else {
        console.log(
          `[PANEL-SNAPSHOT][V2] room=${effect.roomId} — no TableState found`,
        );
      }
      break;
    }

    // ========================================================================
    // UNKNOWN EFFECT
    // ========================================================================

    default:
      console.error("[runEffects] Unknown effect type:", (effect as any).type);
      break;
  }
}

// ============================================================================
// HELPER: Find Socket by User ID
// ============================================================================

/**
 * Find a socket by userId.
 * This requires looking up the participant's socketId in the room state.
 *
 * NOTE: This creates a coupling to roomRegistry, which we want to avoid.
 * We'll handle this properly in the adapter layer.
 */
export function findSocketByUserId(
  io: Server,
  userId: string,
): Socket | undefined {
  // TODO: Implement proper socket lookup
  // For now, we'll leave this as a placeholder
  return undefined;
}

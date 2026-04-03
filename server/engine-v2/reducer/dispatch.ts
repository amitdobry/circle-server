/**
 * Engine V2: Dispatch
 *
 * The ONLY entry point for state mutations.
 * All actions flow through this function.
 *
 * Flow:
 * 1. Validate room exists
 * 2. Check permissions (can user perform this action?)
 * 3. Route to reducer
 * 4. Assert invariants
 * 5. Return effects
 *
 * CRITICAL: dispatch() does NOT execute effects.
 * It returns them for the caller to execute via runEffects().
 */

import { Action, Effect, TableState } from "../state/types";
import { assertInvariantsIfDev } from "../state/invariants";
import { roomRegistry } from "../registry/RoomRegistry";
import { reducer } from "./reducer";
import { canPerformAction } from "./phaseRules";

// ============================================================================
// DISPATCH (Main Entry Point)
// ============================================================================

/**
 * Dispatch an action to a room.
 *
 * @param roomId - The room to dispatch to
 * @param userId - The user performing the action (null for system actions)
 * @param action - The action to perform
 * @returns Array of effects to execute
 */
export function dispatch(
  roomId: string,
  userId: string | null,
  action: Action,
): Effect[] {
  // =========================================================================
  // 1. VALIDATE ROOM EXISTS
  // =========================================================================

  const room = roomRegistry.getRoom(roomId);
  if (!room) {
    console.error(`[dispatch] Room '${roomId}' not found`);
    return [
      {
        type: "SYSTEM_LOG",
        roomId,
        message: `Cannot perform ${action.type}: room not found`,
        level: "error",
      },
    ];
  }

  // =========================================================================
  // 2. PERMISSION CHECK (OPTIONAL - Let reducer handle validation)
  // =========================================================================

  // NOTE: Permission checks are now handled in the reducer transitions.
  // This allows more granular control and better error messages.
  // If a user doesn't exist, the reducer will handle it gracefully.

  // System actions (userId = null) always allowed
  // User actions are validated by the reducer transitions

  // =========================================================================
  // 3. ROUTE TO REDUCER
  // =========================================================================

  const effects = reducer(room, userId, action);

  // Update lastUpdated timestamp
  room.lastUpdated = Date.now();

  // =========================================================================
  // 4. ASSERT INVARIANTS (Development Mode Only)
  // =========================================================================

  try {
    assertInvariantsIfDev(room);
  } catch (error) {
    console.error(
      `[dispatch] Invariant violation after ${action.type}:`,
      error,
    );

    // In development, throw to catch bugs early
    if (process.env.NODE_ENV !== "production") {
      throw error;
    }

    // In production, log error but continue
    return [
      {
        type: "SYSTEM_LOG",
        roomId,
        message: `Critical error: invariant violation after ${action.type}`,
        level: "error",
      },
    ];
  }

  // =========================================================================
  // 5. RETURN EFFECTS
  // =========================================================================

  return effects;
}

// ============================================================================
// HELPER: Dispatch and Run Effects (Convenience Function)
// ============================================================================

/**
 * Dispatch an action and immediately run the effects.
 * This is a convenience function for common use cases.
 *
 * @param roomId - The room to dispatch to
 * @param userId - The user performing the action
 * @param action - The action to perform
 * @param io - Socket.IO server instance
 */
export function dispatchAndRun(
  roomId: string,
  userId: string | null,
  action: Action,
  io: any, // Socket.IO Server type
): void {
  const effects = dispatch(roomId, userId, action);

  // Import runEffects dynamically to avoid circular dependency
  import("../effects/runEffects").then(({ runEffects }) => {
    runEffects(effects, io);
  });
}

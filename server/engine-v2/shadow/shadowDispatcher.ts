/**
 * Engine V2: Shadow Dispatcher
 *
 * Passive observer mode for Engine V2.
 * Runs V2 state machine alongside V1 without affecting production.
 *
 * Purpose:
 * - Validate room isolation
 * - Validate identity mapping
 * - Catch invariant violations early
 * - Learn from real traffic
 * - Zero risk (does not execute effects)
 */

import { dispatch } from "../reducer/dispatch";
import { roomRegistry } from "../registry/RoomRegistry";
import { Action } from "../state/types";

// ============================================================================
// SHADOW DISPATCH (Observer Mode)
// ============================================================================

/**
 * Shadow dispatch: Run V2 state machine but don't execute effects.
 * Only logs observations for validation.
 *
 * @param roomId - Room identifier
 * @param userId - User performing action (null for system)
 * @param action - Action to dispatch
 */
export function shadowDispatch(
  roomId: string,
  userId: string | null,
  action: Action,
): void {
  try {
    // Get or create room in v2 registry
    const room = roomRegistry.getOrCreateRoom(roomId);

    // Capture state before dispatch
    const snapshot = captureStateSnapshot(room);

    // Dispatch to v2 engine (mutates state, returns effects)
    const effects = dispatch(roomId, userId, action);

    // Capture state after dispatch
    const snapshotAfter = captureStateSnapshot(room);

    // Log compact summary
    logShadowDispatch(roomId, userId, action, snapshot, snapshotAfter, effects);
  } catch (error: any) {
    // Catch invariant violations or reducer bugs
    console.error(
      `[V2 Shadow] ❌ ERROR in ${roomId} | ${action.type}:`,
      error.message,
    );

    // Log stack trace in development
    if (process.env.NODE_ENV !== "production") {
      console.error(error.stack);
    }
  }
}

// ============================================================================
// STATE SNAPSHOT (Before/After Comparison)
// ============================================================================

interface StateSnapshot {
  phase: string;
  liveSpeaker: string | null;
  connectedCount: number;
  ghostCount: number;
  participantCount: number;
  pointerMapSize: number;
  syncPause: boolean;
}

function captureStateSnapshot(room: any): StateSnapshot {
  const participants = Array.from(room.participants.values());

  return {
    phase: room.phase,
    liveSpeaker: room.liveSpeaker,
    connectedCount: participants.filter((p: any) => p.presence === "CONNECTED")
      .length,
    ghostCount: participants.filter((p: any) => p.presence === "GHOST").length,
    participantCount: room.participants.size,
    pointerMapSize: room.pointerMap.size,
    syncPause: room.syncPause,
  };
}

// ============================================================================
// LOGGING
// ============================================================================

function logShadowDispatch(
  roomId: string,
  userId: string | null,
  action: Action,
  before: StateSnapshot,
  after: StateSnapshot,
  effects: any[],
): void {
  const userLabel = userId || "SYSTEM";
  const room = roomRegistry.getRoom(roomId);
  const sessionId = room?.sessionId || "unknown";

  // Main log line with session ID
  console.log(
    `[V2 Shadow] 🎯 Room: ${roomId} | Session: ${sessionId.slice(0, 8)}... | User: ${userLabel} | Action: ${action.type}`,
  );

  // Phase transition
  if (before.phase !== after.phase) {
    console.log(`  Phase: ${before.phase} → ${after.phase} ✨`);
  } else {
    console.log(`  Phase: ${after.phase}`);
  }

  // Speaker change
  if (before.liveSpeaker !== after.liveSpeaker) {
    console.log(
      `  Speaker: ${before.liveSpeaker || "none"} → ${after.liveSpeaker || "none"} ✨`,
    );
  } else if (after.liveSpeaker) {
    console.log(`  Speaker: ${after.liveSpeaker}`);
  }

  // Presence counts (highlight changes)
  if (
    before.connectedCount !== after.connectedCount ||
    before.ghostCount !== after.ghostCount
  ) {
    console.log(
      `  Connected: ${before.connectedCount} → ${after.connectedCount} ✨`,
    );
    console.log(`  Ghosts: ${before.ghostCount} → ${after.ghostCount} ✨`);
  } else {
    console.log(
      `  Connected: ${after.connectedCount} | Ghosts: ${after.ghostCount}`,
    );
  }

  // Total participants
  if (before.participantCount !== after.participantCount) {
    console.log(
      `  Total Participants: ${before.participantCount} → ${after.participantCount} ✨`,
    );
  }

  // Pointer map
  if (before.pointerMapSize !== after.pointerMapSize) {
    console.log(
      `  Pointers: ${before.pointerMapSize} → ${after.pointerMapSize} ✨`,
    );
  }

  // Sync pause flag
  if (before.syncPause !== after.syncPause) {
    console.log(`  SyncPause: ${before.syncPause} → ${after.syncPause} ✨`);
  }

  // Effects generated
  console.log(`  Effects Generated: ${effects.length}`);
  if (effects.length > 0) {
    // Show effect types
    const effectTypes = effects.map((e: any) => e.type).join(", ");
    console.log(`    → ${effectTypes}`);
  }

  // Invariants passed
  console.log(`  Invariants: ✅ OK`);

  // Separator
  console.log("");
}

// ============================================================================
// SHADOW MODE STATUS
// ============================================================================

let shadowModeEnabled = false;

export function enableShadowMode(): void {
  shadowModeEnabled = true;
  console.log(
    "[V2 Shadow] 🔍 Shadow mode ENABLED - V2 running as passive observer",
  );
}

export function disableShadowMode(): void {
  shadowModeEnabled = false;
  console.log("[V2 Shadow] Shadow mode DISABLED");
}

export function isShadowModeEnabled(): boolean {
  return shadowModeEnabled;
}

// ============================================================================
// EXPORT TOGGLE
// ============================================================================

// Auto-enable in development
if (process.env.ENGINE_V2_SHADOW === "true") {
  enableShadowMode();
}

/**
 * Engine V2: State Defaults
 *
 * Factory functions for creating initial state objects.
 * All state initialization must go through these functions.
 */

import { v4 as uuidv4 } from "uuid";
import {
  TableState,
  ParticipantState,
  SessionTimerState,
  PresenceState,
  ParticipantRole,
} from "./types";

// ============================================================================
// TABLE STATE FACTORY
// ============================================================================

/**
 * Creates a new TableState for a room.
 * This is the only way to initialize a room's state.
 */
export function createInitialTableState(roomId: string): TableState {
  return {
    // Identity
    sessionId: uuidv4(),
    roomId,
    engineVersion: "v2",

    // Phase
    phase: "LOBBY",

    // Participants (empty Map)
    participants: new Map(),

    // Attention mechanism
    pointerMap: new Map(),
    liveSpeaker: null,
    syncPause: false,

    // Timer (inactive by default)
    timer: createInactiveTimer(),

    // Lifecycle
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };
}

// ============================================================================
// PARTICIPANT STATE FACTORY
// ============================================================================

/**
 * Creates a new ParticipantState for a joining user.
 */
export function createParticipantState(
  userId: string,
  displayName: string,
  avatarId: string,
  socketId: string | null = null,
): ParticipantState {
  return {
    // Identity
    userId,
    socketId,
    displayName,
    avatarId,

    // Role (default listener)
    role: "listener",

    // Presence (default connected if socketId provided)
    presence: socketId ? "CONNECTED" : "GHOST",

    // Attention
    attentionTarget: null,

    // Timestamps
    joinedAt: Date.now(),
    lastSeen: Date.now(),
  };
}

// ============================================================================
// TIMER FACTORY
// ============================================================================

/**
 * Creates an inactive timer state.
 */
export function createInactiveTimer(): SessionTimerState {
  return {
    active: false,
    startTime: 0,
    durationMs: 0,
  };
}

/**
 * Creates an active timer state.
 */
export function createActiveTimer(durationMs: number): SessionTimerState {
  const startTime = Date.now();
  return {
    active: true,
    startTime,
    durationMs,
    endTime: startTime + durationMs,
  };
}

// ============================================================================
// DEFAULT VALUES (Constants)
// ============================================================================

/**
 * Default session duration: 60 minutes
 */
export const DEFAULT_SESSION_DURATION_MS = 60 * 60 * 1000;

/**
 * Grace period before room cleanup: 30 seconds
 */
export const GRACE_PERIOD_MS = 30 * 1000;

/**
 * Sync pause duration: 2 seconds
 */
export const SYNC_PAUSE_DURATION_MS = 2000;

/**
 * Force cleanup after 24 hours (memory leak safeguard)
 */
export const FORCE_CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Orphan detection threshold: 10 minutes of inactivity
 */
export const ORPHAN_THRESHOLD_MS = 10 * 60 * 1000;

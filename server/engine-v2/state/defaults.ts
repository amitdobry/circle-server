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
  ContentPhaseState,
  RoundState,
} from "./types";

// ============================================================================
// TABLE STATE FACTORY
// ============================================================================

/**
 * Creates a new TableState for a room.
 * This is the only way to initialize a room's state.
 */
export function createInitialTableState(
  roomId: string,
  tableId: string, // 🆕 Table identity (e.g., "hearth")
): TableState {
  return {
    // Identity
    sessionId: uuidv4(),
    roomId,
    tableId, // 🆕 Store table identity
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

    // 🆕 Round system (Content Phase Feature)
    currentRound: null,
    roundsHistory: [],
    contentPhase: null,

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

// ============================================================================
// CONTENT PHASE & ROUND FACTORIES (🆕 Content Phase Feature)
// ============================================================================

/**
 * Creates a new ContentPhaseState for voting
 */
export function createContentPhaseState(
  themeKey: string,
  targetRoundNumber: number,
): ContentPhaseState {
  return {
    status: "voting",
    tableThemeKey: themeKey,
    targetRoundNumber,
    votes: new Map(),
    selectedSubjectKey: null,
    selectedQuestionId: null,
    selectedQuestionText: null,
  };
}

/**
 * Creates a new RoundState
 */
export function createRound(config: {
  roundNumber: number;
  tableThemeKey: string;
  subjectKey: string;
  questionId: string;
  glyphText: string;
}): RoundState {
  return {
    roundId: uuidv4(),
    roundNumber: config.roundNumber,
    status: "active",
    tableThemeKey: config.tableThemeKey,
    subjectKey: config.subjectKey,
    questionId: config.questionId,
    glyphText: config.glyphText,
    readyUserIds: new Set(),
    startedAt: Date.now(),
    endedAt: null,
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

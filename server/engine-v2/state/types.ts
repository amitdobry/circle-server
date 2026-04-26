/**
 * Engine V2: State Types
 *
 * Core type definitions for the SoulCircle multiplayer state machine.
 * These types form the single source of truth for all session state.
 */

// ============================================================================
// SESSION PHASES
// ============================================================================

export type SessionPhase =
  | "LOBBY" // Pre-session, users joining
  | "CONTENT_PHASE" // 🆕 Voting on philosophical subjects
  | "ATTENTION_SELECTION" // Picker mode, deciding who speaks
  | "SYNC_PAUSE" // Brief freeze after consensus (2-3 seconds)
  | "LIVE_SPEAKER" // Someone has the mic
  | "TRANSITION" // Between speakers (mic handoff)
  | "ENDING" // Session timer expired, wrap-up (30s grace)
  | "ENDED"; // Session complete, cleanup

// ============================================================================
// PRESENCE STATES
// ============================================================================

export type PresenceState =
  | "CONNECTED" // User is online, active
  | "GHOST" // User disconnected, seat preserved
  | "LEFT"; // User explicitly left, removed from session

// ============================================================================
// ROLES
// ============================================================================

export type ParticipantRole =
  | "listener" // Default role, can vote
  | "speaker" // Currently has the mic
  | "firekeeper"; // Reserved for future (admin/moderator)

// ============================================================================
// PARTICIPANT STATE
// ============================================================================

export interface ParticipantState {
  // Identity (stable across reconnects)
  userId: string; // From authentication (primary key)
  socketId: string | null; // Current connection (null when ghost)
  displayName: string; // UI name
  avatarId: string; // Avatar identifier

  // Role & permissions
  role: ParticipantRole;

  // Presence
  presence: PresenceState;

  // Attention target (who this user is pointing to)
  attentionTarget: string | null; // userId or null

  // Timestamps
  joinedAt: number; // Unix timestamp (ms)
  lastSeen: number; // Last activity timestamp
}

// ============================================================================
// TIMER STATE
// ============================================================================

export interface SessionTimerState {
  active: boolean; // Is timer running?
  startTime: number; // When timer started (Unix ms)
  durationMs: number; // Total duration in milliseconds
  endTime?: number; // When timer will expire (startTime + durationMs)
}

// ============================================================================
// ROUND STATE (Content Phase Feature)
// ============================================================================

/**
 * RoundState - One question cycle with its own Glyph
 *
 * Round = data/meaning container (NOT a phase)
 * A session can have multiple rounds.
 * Glyph lives INSIDE round (NOT separate state).
 */
export interface RoundState {
  roundId: string; // UUID for this round
  roundNumber: number; // Sequential number (1, 2, 3...)
  status: "active" | "ended"; // Round lifecycle

  // Content identity
  tableThemeKey: string; // e.g., "philosophy"
  subjectKey: string; // e.g., "truth"
  questionId: string; // e.g., "truth_q3"

  // 🔥 GLYPH (lives here, NOT in separate state)
  glyphText: string; // The actual question text

  // Readiness tracking (unanimous consensus)
  readyUserIds: Set<string>; // Users who marked ready for next question

  // Timestamps
  startedAt: number; // Unix timestamp (ms)
  endedAt: number | null; // null while active
}

/**
 * ContentPhaseState - Voting state for round creation
 *
 * Temporary state during CONTENT_PHASE.
 * Cleared after round starts.
 */
export interface ContentPhaseState {
  status: "voting" | "resolved";
  tableThemeKey: string; // e.g., "philosophy"
  targetRoundNumber: number; // Which round number we're creating
  votes: Map<string, string>; // userId -> subjectKey
  selectedSubjectKey: string | null;
  selectedQuestionId: string | null;
  selectedQuestionText: string | null;
}

// ============================================================================
// TABLE STATE (Single Source of Truth)
// ============================================================================

export interface TableState {
  // Identity
  sessionId: string; // UUID for this session
  roomId: string; // URL-based room identifier
  tableId: string; // 🆕 Table identity (e.g., "hearth", "bridge") - USE THIS for content lookup
  engineVersion: "v1" | "v2"; // Which engine is running this room

  // Phase control
  phase: SessionPhase;

  // Participants (key = userId, not socketId)
  participants: Map<string, ParticipantState>;

  // Attention mechanism
  pointerMap: Map<string, string>; // userId -> targetUserId
  liveSpeaker: string | null; // Current speaker's userId
  syncPause: boolean; // Is consensus lock active?

  // Timer
  timer: SessionTimerState;

  // 🆕 ROUND SYSTEM (Content Phase Feature)
  currentRound: RoundState | null; // Active round (includes Glyph)
  roundsHistory: RoundState[]; // Previous rounds (in-memory for MVP)
  contentPhase: ContentPhaseState | null; // Temporary voting state

  // Lifecycle
  createdAt: number; // Unix timestamp (ms)
  lastUpdated: number; // Last mutation timestamp
  endingStartTime?: number; // When ENDING phase began (for grace period)
}

// ============================================================================
// EFFECT TYPES (Side Effects, Not State Mutations)
// ============================================================================

export type Effect =
  // Socket emissions (room-scoped)
  | {
      type: "SOCKET_EMIT_ROOM";
      roomId: string;
      event: string;
      data: any;
    }
  // Socket emissions (user-scoped)
  | {
      type: "SOCKET_EMIT_USER";
      userId: string;
      event: string;
      data: any;
    }
  // Full state snapshot to reconnecting user
  | {
      type: "EMIT_FULL_STATE_TO_USER";
      userId: string;
      snapshot: StateSnapshot;
    }
  // UI panel configuration
  | {
      type: "EMIT_PANEL_CONFIG";
      userId: string;
      config: any; // PanelConfig type (to be defined in ui/)
    }
  // Gliff log operations (uses V1 format for compatibility)
  | {
      type: "GLIFF_APPEND";
      roomId: string;
      entry: {
        userName: string;
        message: {
          messageType: "gesture" | "action" | "textInput" | "context";
          content: string;
          timestamp?: number;
          emoji?: string;
        };
      };
    }
  | {
      type: "CLEAR_GLIFF";
      roomId: string;
    }
  // Timer operations
  | {
      type: "TIMER_START";
      roomId: string;
      durationMs: number;
    }
  | {
      type: "TIMER_CANCEL";
      roomId: string;
    }
  // System logging
  | {
      type: "SYSTEM_LOG";
      roomId: string;
      message: string;
      level?: "info" | "warn" | "error";
    }
  // Delayed action (schedules future dispatch)
  | {
      type: "DELAYED_ACTION";
      key?: string;
      roomId: string;
      delayMs: number;
      action: Action;
    }
  // Room lifecycle
  | {
      type: "SCHEDULE_CLEANUP";
      roomId: string;
      delayMs: number;
    }
  | {
      type: "EXECUTE_CLEANUP";
      roomId: string;
    }
  | {
      type: "CANCEL_CLEANUP";
      roomId: string;
    }
  | {
      type: "REBUILD_ALL_PANELS";
      roomId: string;
    }
  // 🆕 Round & Readiness (Content Phase Feature)
  | {
      type: "EMIT_ROUND_STATE";
      roomId: string;
    }
  | {
      type: "EMIT_READINESS_UPDATE";
      roomId: string;
    };

// ============================================================================
// ACTION TYPES (User Intent)
// ============================================================================

export interface Action {
  type: string;
  payload?: any;
}

// ============================================================================
// SERIALIZED STATE (For Network Transmission)
// ============================================================================

export interface StateSnapshot {
  participants: SerializedParticipant[];
  phase: SessionPhase;
  pointerMap: Record<string, string>; // Serialized Map
  liveSpeaker: string | null;
  syncPause: boolean;
  timer: SessionTimerState;
}

export interface SerializedParticipant {
  userId: string;
  socketId: string | null;
  displayName: string;
  avatarId: string;
  role: ParticipantRole;
  presence: PresenceState;
  attentionTarget: string | null;
  joinedAt: number;
  lastSeen: number;
}

// ============================================================================
// GLIFF MESSAGE (Conversation Log Entry)
// ============================================================================

export interface GliffMessage {
  id: string;
  type: "text" | "gesture" | "system";
  userId?: string; // Who sent it (undefined for system messages)
  displayName?: string;
  avatarId?: string;
  content: string; // Text content or gesture emoji
  timestamp: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// INVARIANT VIOLATION ERROR
// ============================================================================

export class InvariantViolation extends Error {
  constructor(message: string) {
    super(`[Invariant Violation] ${message}`);
    this.name = "InvariantViolation";
  }
}

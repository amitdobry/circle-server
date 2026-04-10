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
// TABLE STATE (Single Source of Truth)
// ============================================================================

export interface TableState {
  // Identity
  sessionId: string; // UUID for this session
  roomId: string; // URL-based room identifier
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
  // Gliff log operations
  | {
      type: "GLIFF_APPEND";
      roomId: string;
      entry: GliffMessage;
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

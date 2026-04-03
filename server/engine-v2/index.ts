/**
 * Engine V2: Public API
 *
 * Main entry point for the SoulCircle multiplayer state engine.
 * Import this module to use the engine.
 */

// ============================================================================
// CORE DISPATCH
// ============================================================================

export { dispatch, dispatchAndRun } from "./reducer/dispatch";

// ============================================================================
// REGISTRY
// ============================================================================

export { roomRegistry } from "./registry/RoomRegistry";

// ============================================================================
// STATE TYPES
// ============================================================================

export type {
  TableState,
  ParticipantState,
  SessionPhase,
  PresenceState,
  ParticipantRole,
  Action,
  Effect,
  StateSnapshot,
  SerializedParticipant,
  GliffMessage,
} from "./state/types";

export { InvariantViolation } from "./state/types";

// ============================================================================
// STATE UTILITIES
// ============================================================================

export {
  createInitialTableState,
  createParticipantState,
  createInactiveTimer,
  createActiveTimer,
  DEFAULT_SESSION_DURATION_MS,
  GRACE_PERIOD_MS,
  SYNC_PAUSE_DURATION_MS,
} from "./state/defaults";

export {
  assertInvariants,
  assertInvariantsIfDev,
  INVARIANT_DESCRIPTIONS,
} from "./state/invariants";

export {
  getConnectedParticipants,
  getGhostParticipants,
  getParticipant,
  getParticipantBySocketId,
  getLiveSpeaker,
  getPointerTarget,
  getPointersToTarget,
  getVoteCounts,
  evaluateConsensus,
  hasConsensus,
  isTimerExpired,
  getRemainingTime,
  isInGracePeriod,
  shouldCleanup,
  isAvatarAvailable,
  getTakenAvatars,
  serializeParticipants,
  serializePointerMap,
} from "./state/selectors";

// ============================================================================
// ACTION TYPES
// ============================================================================

export * as ActionTypes from "./actions/actionTypes";

// ============================================================================
// EFFECTS
// ============================================================================

export { runEffects } from "./effects/runEffects";

// ============================================================================
// PHASE RULES
// ============================================================================

export { canPerformAction } from "./reducer/phaseRules";

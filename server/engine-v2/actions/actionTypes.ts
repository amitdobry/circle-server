/**
 * Engine V2: Action Types
 *
 * String constants for all action types.
 * These represent user intent and trigger state transitions.
 */

// ============================================================================
// SESSION LIFECYCLE
// ============================================================================

export const JOIN_SESSION = "JOIN_SESSION";
export const LEAVE_SESSION = "LEAVE_SESSION";
export const DISCONNECT = "DISCONNECT";
export const RECONNECT = "RECONNECT";
export const PURGE_GHOST = "PURGE_GHOST"; // Remove ghost after timeout

// ============================================================================
// ATTENTION & CONSENSUS
// ============================================================================

export const POINT_TO_USER = "POINT_TO_USER";
export const CLICK_READY_TO_GLOW = "CLICK_READY_TO_GLOW";
export const EVALUATE_SYNC = "EVALUATE_SYNC";
export const SET_LIVE_SPEAKER = "SET_LIVE_SPEAKER";

// ============================================================================
// SPEAKING & MIC CONTROL
// ============================================================================

export const DROP_MIC = "DROP_MIC";
export const PASS_MIC = "PASS_MIC";
export const ACCEPT_MIC = "ACCEPT_MIC";
export const DECLINE_MIC = "DECLINE_MIC";

// ============================================================================
// GESTURES & COMMUNICATION
// ============================================================================

export const SEND_GESTURE = "SEND_GESTURE";
export const TEXT_INPUT = "TEXT_INPUT";

// ============================================================================
// TIMER & SESSION END
// ============================================================================

export const TIMER_EXPIRED = "TIMER_EXPIRED";
export const END_SESSION = "END_SESSION";
export const ADMIN_END_SESSION = "ADMIN_END_SESSION"; // Admin manually ends session

// ============================================================================
// SYSTEM ACTIONS (Internal)
// ============================================================================

export const NO_OP = "NO_OP"; // For testing

"use strict";
/**
 * Engine V2: Action Types
 *
 * String constants for all action types.
 * These represent user intent and trigger state transitions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_OP = exports.ROUND_UNMARK_READY = exports.ROUND_MARK_READY = exports.END_ROUND = exports.START_ROUND = exports.RESOLVE_CONTENT_PHASE = exports.VOTE_CONTENT_SUBJECT = exports.START_CONTENT_PHASE = exports.ADMIN_END_SESSION = exports.END_SESSION = exports.TIMER_EXPIRED = exports.TEXT_INPUT = exports.SEND_GESTURE = exports.DECLINE_MIC = exports.ACCEPT_MIC = exports.PASS_MIC = exports.DROP_MIC = exports.SET_LIVE_SPEAKER = exports.EVALUATE_SYNC = exports.CLICK_READY_TO_GLOW = exports.POINT_TO_USER = exports.PURGE_GHOST = exports.RECONNECT = exports.DISCONNECT = exports.LEAVE_SESSION = exports.JOIN_SESSION = void 0;
// ============================================================================
// SESSION LIFECYCLE
// ============================================================================
exports.JOIN_SESSION = "JOIN_SESSION";
exports.LEAVE_SESSION = "LEAVE_SESSION";
exports.DISCONNECT = "DISCONNECT";
exports.RECONNECT = "RECONNECT";
exports.PURGE_GHOST = "PURGE_GHOST"; // Remove ghost after timeout
// ============================================================================
// ATTENTION & CONSENSUS
// ============================================================================
exports.POINT_TO_USER = "POINT_TO_USER";
exports.CLICK_READY_TO_GLOW = "CLICK_READY_TO_GLOW";
exports.EVALUATE_SYNC = "EVALUATE_SYNC";
exports.SET_LIVE_SPEAKER = "SET_LIVE_SPEAKER";
// ============================================================================
// SPEAKING & MIC CONTROL
// ============================================================================
exports.DROP_MIC = "DROP_MIC";
exports.PASS_MIC = "PASS_MIC";
exports.ACCEPT_MIC = "ACCEPT_MIC";
exports.DECLINE_MIC = "DECLINE_MIC";
// ============================================================================
// GESTURES & COMMUNICATION
// ============================================================================
exports.SEND_GESTURE = "SEND_GESTURE";
exports.TEXT_INPUT = "TEXT_INPUT";
// ============================================================================
// TIMER & SESSION END
// ============================================================================
exports.TIMER_EXPIRED = "TIMER_EXPIRED";
exports.END_SESSION = "END_SESSION";
exports.ADMIN_END_SESSION = "ADMIN_END_SESSION"; // Admin manually ends session
// ============================================================================
// CONTENT PHASE & ROUNDS (🆕 Feature)
// ============================================================================
exports.START_CONTENT_PHASE = "START_CONTENT_PHASE";
exports.VOTE_CONTENT_SUBJECT = "VOTE_CONTENT_SUBJECT";
exports.RESOLVE_CONTENT_PHASE = "RESOLVE_CONTENT_PHASE";
exports.START_ROUND = "START_ROUND";
exports.END_ROUND = "END_ROUND";
exports.ROUND_MARK_READY = "ROUND_MARK_READY";
exports.ROUND_UNMARK_READY = "ROUND_UNMARK_READY";
// ============================================================================
// SYSTEM ACTIONS (Internal)
// ============================================================================
exports.NO_OP = "NO_OP"; // For testing

/**
 * Engine V2: Phase Rules
 *
 * Permission system for action validation.
 * Determines if a user can perform an action based on:
 * - Current session phase
 * - User's presence state
 * - User's role (future: firekeeper overrides)
 */

import { TableState } from "../state/types";
import { getParticipant } from "../state/selectors";
import * as ActionTypes from "../actions/actionTypes";

// ============================================================================
// MAIN PERMISSION CHECK
// ============================================================================

/**
 * Check if a user can perform an action in the current state.
 *
 * @param userId - The user attempting the action
 * @param actionType - The action type string
 * @param tableState - Current room state
 * @returns true if action is allowed, false otherwise
 */
export function canPerformAction(
  userId: string,
  actionType: string,
  tableState: TableState,
): boolean {
  const participant = getParticipant(tableState, userId);

  // If user doesn't exist, only allow JOIN_SESSION
  if (!participant) {
    return actionType === ActionTypes.JOIN_SESSION;
  }

  // Ghost users can only RECONNECT or LEAVE
  if (participant.presence === "GHOST") {
    return (
      actionType === ActionTypes.RECONNECT ||
      actionType === ActionTypes.LEAVE_SESSION
    );
  }

  // Check phase-based rules
  return checkPhaseRules(actionType, tableState.phase);
}

// ============================================================================
// PHASE-BASED RULES
// ============================================================================

/**
 * Check if an action is allowed in a given phase.
 */
function checkPhaseRules(actionType: string, phase: string): boolean {
  switch (phase) {
    case "LOBBY":
      return checkLobbyRules(actionType);

    case "ATTENTION_SELECTION":
      return checkAttentionSelectionRules(actionType);

    case "SYNC_PAUSE":
      return checkSyncPauseRules(actionType);

    case "LIVE_SPEAKER":
      return checkLiveSpeakerRules(actionType);

    case "TRANSITION":
      return checkTransitionRules(actionType);

    case "ENDING":
    case "ENDED":
      return checkEndingRules(actionType);

    default:
      console.warn(`[phaseRules] Unknown phase: ${phase}`);
      return false;
  }
}

// ============================================================================
// LOBBY PHASE RULES
// ============================================================================

function checkLobbyRules(actionType: string): boolean {
  // In LOBBY, users can join, leave, or ready up
  return [
    ActionTypes.JOIN_SESSION,
    ActionTypes.LEAVE_SESSION,
    ActionTypes.DISCONNECT,
    ActionTypes.CLICK_READY_TO_GLOW,
    ActionTypes.SEND_GESTURE,
  ].includes(actionType);
}

// ============================================================================
// ATTENTION_SELECTION PHASE RULES (Picker Mode)
// ============================================================================

function checkAttentionSelectionRules(actionType: string): boolean {
  // During picker mode, users can point, leave, or send gestures
  return [
    ActionTypes.POINT_TO_USER,
    ActionTypes.LEAVE_SESSION,
    ActionTypes.DISCONNECT,
    ActionTypes.SEND_GESTURE,
    ActionTypes.TEXT_INPUT,
  ].includes(actionType);
}

// ============================================================================
// SYNC_PAUSE PHASE RULES (Consensus Lock)
// ============================================================================

function checkSyncPauseRules(actionType: string): boolean {
  // During SYNC_PAUSE (2 second lock):
  // - NO pointer changes (deterministic freeze)
  // - NO ready-to-glow
  // - NO text input
  // - Gestures allowed (emotional expression)
  // - Disconnect/reconnect allowed (can't prevent)

  return [
    ActionTypes.SEND_GESTURE,
    ActionTypes.DISCONNECT,
    ActionTypes.RECONNECT,
    ActionTypes.LEAVE_SESSION,
  ].includes(actionType);
}

// ============================================================================
// LIVE_SPEAKER PHASE RULES
// ============================================================================

function checkLiveSpeakerRules(actionType: string): boolean {
  // During active speaking:
  // - Speaker can drop mic, pass mic, type, send gestures
  // - Listeners can send gestures, listen
  // - No one can request ready-to-glow (can't interrupt speaker)
  // - No one can point (consensus already achieved)

  return [
    ActionTypes.DROP_MIC,
    ActionTypes.PASS_MIC,
    ActionTypes.ACCEPT_MIC,
    ActionTypes.DECLINE_MIC,
    ActionTypes.TEXT_INPUT,
    ActionTypes.SEND_GESTURE,
    ActionTypes.DISCONNECT,
    ActionTypes.RECONNECT,
    ActionTypes.LEAVE_SESSION,
  ].includes(actionType);
}

// ============================================================================
// TRANSITION PHASE RULES (Mic Handoff)
// ============================================================================

function checkTransitionRules(actionType: string): boolean {
  // During mic handoff:
  // - Accept/decline mic actions allowed
  // - Gestures allowed
  // - Disconnect/leave allowed
  // - No pointing or ready-to-glow

  return [
    ActionTypes.ACCEPT_MIC,
    ActionTypes.DECLINE_MIC,
    ActionTypes.SEND_GESTURE,
    ActionTypes.DISCONNECT,
    ActionTypes.RECONNECT,
    ActionTypes.LEAVE_SESSION,
  ].includes(actionType);
}

// ============================================================================
// ENDING/ENDED PHASE RULES
// ============================================================================

function checkEndingRules(actionType: string): boolean {
  // During session end:
  // - Only leave, disconnect, or gestures allowed

  return [
    ActionTypes.LEAVE_SESSION,
    ActionTypes.DISCONNECT,
    ActionTypes.SEND_GESTURE,
  ].includes(actionType);
}

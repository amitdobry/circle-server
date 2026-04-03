"use strict";
/**
 * Engine V2: Phase Rules
 *
 * Permission system for action validation.
 * Determines if a user can perform an action based on:
 * - Current session phase
 * - User's presence state
 * - User's role (future: firekeeper overrides)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.canPerformAction = canPerformAction;
const selectors_1 = require("../state/selectors");
const ActionTypes = __importStar(require("../actions/actionTypes"));
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
function canPerformAction(userId, actionType, tableState) {
    const participant = (0, selectors_1.getParticipant)(tableState, userId);
    // If user doesn't exist, only allow JOIN_SESSION
    if (!participant) {
        return actionType === ActionTypes.JOIN_SESSION;
    }
    // Ghost users can only RECONNECT or LEAVE
    if (participant.presence === "GHOST") {
        return (actionType === ActionTypes.RECONNECT ||
            actionType === ActionTypes.LEAVE_SESSION);
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
function checkPhaseRules(actionType, phase) {
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
function checkLobbyRules(actionType) {
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
function checkAttentionSelectionRules(actionType) {
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
function checkSyncPauseRules(actionType) {
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
function checkLiveSpeakerRules(actionType) {
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
function checkTransitionRules(actionType) {
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
function checkEndingRules(actionType) {
    // During session end:
    // - Only leave, disconnect, or gestures allowed
    return [
        ActionTypes.LEAVE_SESSION,
        ActionTypes.DISCONNECT,
        ActionTypes.SEND_GESTURE,
    ].includes(actionType);
}

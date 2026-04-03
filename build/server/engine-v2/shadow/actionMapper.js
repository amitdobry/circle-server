"use strict";
/**
 * Engine V2: Action Mapper
 *
 * Maps legacy V1 socket event names to V2 action types.
 * This allows shadow mode to translate incoming events
 * into the canonical V2 action format.
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
exports.mapLegacyEventToV2ActionType = mapLegacyEventToV2ActionType;
exports.mapLegacyToV2Action = mapLegacyToV2Action;
exports.extractUserId = extractUserId;
exports.extractRoomId = extractRoomId;
const ActionTypes = __importStar(require("../actions/actionTypes"));
// ============================================================================
// LEGACY EVENT NAME → V2 ACTION TYPE
// ============================================================================
/**
 * Map legacy socket event name to V2 action type.
 * Returns the canonical V2 action type string.
 */
function mapLegacyEventToV2ActionType(legacyEvent) {
    const mapping = {
        // Session lifecycle
        "request-join": ActionTypes.JOIN_SESSION,
        "joined-table": ActionTypes.JOIN_SESSION, // Alternate join event
        leave: ActionTypes.LEAVE_SESSION,
        disconnect: ActionTypes.DISCONNECT,
        reconnect: ActionTypes.RECONNECT,
        // Attention & pointing
        pointing: ActionTypes.POINT_TO_USER,
        "change-pointing": ActionTypes.POINT_TO_USER, // Alternate name
        // Session control
        "start-session": ActionTypes.CLICK_READY_TO_GLOW, // Maps to ready-to-glow
        // Mic control
        "drop-mic": ActionTypes.DROP_MIC,
        "pass-mic": ActionTypes.PASS_MIC,
        "accept-mic": ActionTypes.ACCEPT_MIC,
        "decline-mic": ActionTypes.DECLINE_MIC,
        // Communication
        gesture: ActionTypes.SEND_GESTURE,
        "send-gesture": ActionTypes.SEND_GESTURE,
        "text-input": ActionTypes.TEXT_INPUT,
        // Timer
        "timer-expired": ActionTypes.TIMER_EXPIRED,
        "end-session": ActionTypes.END_SESSION,
    };
    return mapping[legacyEvent] || "UNHANDLED_ACTION";
}
// ============================================================================
// LEGACY PAYLOAD → V2 ACTION
// ============================================================================
/**
 * Convert legacy socket event + payload to V2 Action format.
 *
 * @param legacyEvent - Socket event name (e.g., "request-join")
 * @param legacyPayload - Event data from client
 * @returns V2 Action object
 */
function mapLegacyToV2Action(legacyEvent, legacyPayload) {
    const actionType = mapLegacyEventToV2ActionType(legacyEvent);
    // Map payload based on action type
    switch (actionType) {
        case ActionTypes.JOIN_SESSION:
            return {
                type: actionType,
                payload: {
                    displayName: legacyPayload.name,
                    avatarId: legacyPayload.avatarId || legacyPayload.avatar,
                    socketId: legacyPayload.socketId, // Pass socketId through
                },
            };
        case ActionTypes.POINT_TO_USER:
            return {
                type: actionType,
                payload: {
                    targetUserId: legacyPayload.to,
                },
            };
        case ActionTypes.SEND_GESTURE:
            return {
                type: actionType,
                payload: {
                    gestureCode: legacyPayload.code || legacyPayload.gestureCode,
                    emoji: legacyPayload.emoji,
                    listenerType: legacyPayload.listenerType,
                },
            };
        case ActionTypes.TEXT_INPUT:
            return {
                type: actionType,
                payload: {
                    char: legacyPayload.char || legacyPayload.text,
                },
            };
        case ActionTypes.PASS_MIC:
            return {
                type: actionType,
                payload: {
                    targetUserId: legacyPayload.to || legacyPayload.targetUserId,
                },
            };
        case ActionTypes.CLICK_READY_TO_GLOW:
            return {
                type: actionType,
                payload: {
                    durationMinutes: legacyPayload.durationMinutes || 60,
                },
            };
        // Actions with no payload
        case ActionTypes.LEAVE_SESSION:
        case ActionTypes.DISCONNECT:
        case ActionTypes.RECONNECT:
        case ActionTypes.DROP_MIC:
        case ActionTypes.ACCEPT_MIC:
        case ActionTypes.DECLINE_MIC:
        case ActionTypes.TIMER_EXPIRED:
        case ActionTypes.END_SESSION:
            return {
                type: actionType,
                payload: {},
            };
        // Unhandled action
        default:
            return {
                type: "UNHANDLED_ACTION",
                payload: {
                    legacyEvent,
                    legacyPayload,
                },
            };
    }
}
// ============================================================================
// USER ID EXTRACTION
// ============================================================================
/**
 * Extract userId from socket or payload.
 *
 * In V1, user identity is tracked by:
 * - socket.id (socketId)
 * - payload.name (displayName)
 * - payload.from (in pointing events)
 *
 * For V2, we need stable userId.
 * For now, we'll use socketId as userId (not ideal, but safe for shadow mode).
 *
 * @param socket - Socket.IO socket
 * @param legacyPayload - Event payload
 * @returns userId string
 */
function extractUserId(socket, legacyPayload) {
    // Priority 1: Explicit userId in payload (if we add auth later)
    if (legacyPayload.userId) {
        return legacyPayload.userId;
    }
    // Priority 2: "from" field (used in pointing events)
    if (legacyPayload.from) {
        return legacyPayload.from;
    }
    // Priority 3: Socket ID (fallback)
    return socket.id;
}
// ============================================================================
// ROOM ID EXTRACTION
// ============================================================================
/**
 * Extract roomId from socket or payload.
 *
 * For now, V1 has a single implicit room.
 * We'll use "default-room" as the roomId.
 *
 * Later, when URL routing is added, we'll extract from socket.data.roomId.
 */
function extractRoomId(socket, legacyPayload) {
    // Priority 1: Explicit roomId in socket data (future)
    if (socket.data?.roomId) {
        return socket.data.roomId;
    }
    // Priority 2: Payload roomId (future)
    if (legacyPayload.roomId) {
        return legacyPayload.roomId;
    }
    // Fallback: Single room (V1 behavior)
    return "default-room";
}

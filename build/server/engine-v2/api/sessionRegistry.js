"use strict";
/**
 * Engine V2: Session Registry API
 *
 * Public API for querying session state.
 * V1 socket handlers use this to query V2 as the source of truth.
 *
 * This is the bridge between V1 (imperative) and V2 (event-sourced).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionRegistry = void 0;
exports.getAllSessions = getAllSessions;
exports.getSession = getSession;
exports.getSessionForRoom = getSessionForRoom;
exports.getUserSession = getUserSession;
exports.isSessionActive = isSessionActive;
exports.getSessionUsers = getSessionUsers;
exports.getSessionCount = getSessionCount;
exports.getTotalUserCount = getTotalUserCount;
exports.getSessionStats = getSessionStats;
const RoomRegistry_1 = require("../registry/RoomRegistry");
// ============================================================================
// PUBLIC API
// ============================================================================
/**
 * Get all active sessions across all rooms
 */
function getAllSessions() {
    const rooms = RoomRegistry_1.roomRegistry.getAllRooms();
    const sessions = [];
    for (const [_roomId, tableState] of rooms) {
        sessions.push(createSessionInfo(tableState));
    }
    return sessions;
}
/**
 * Get specific session by session ID
 */
function getSession(sessionId) {
    const room = RoomRegistry_1.roomRegistry.findRoomBySessionId(sessionId);
    return room ? createSessionInfo(room) : null;
}
/**
 * Get session for a specific room
 */
function getSessionForRoom(roomId) {
    const room = RoomRegistry_1.roomRegistry.getRoom(roomId);
    return room ? createSessionInfo(room) : null;
}
/**
 * Check if user is in any session (by socketId or userId)
 */
function getUserSession(identifier) {
    const room = RoomRegistry_1.roomRegistry.findUserRoom(identifier);
    return room ? createSessionInfo(room) : null;
}
/**
 * Check if session is active (not in LOBBY or ENDED)
 */
function isSessionActive(sessionId) {
    const session = getSession(sessionId);
    return session ? session.isActive : false;
}
/**
 * Get all users in a session (returns socketIds for V1 compatibility)
 */
function getSessionUsers(sessionId) {
    const session = getSession(sessionId);
    return session ? session.users : [];
}
/**
 * Get session count
 */
function getSessionCount() {
    return getAllSessions().length;
}
/**
 * Get total connected user count across all sessions
 */
function getTotalUserCount() {
    const sessions = getAllSessions();
    return sessions.reduce((sum, s) => sum + s.connectedCount, 0);
}
/**
 * Get session statistics
 */
function getSessionStats() {
    const sessions = getAllSessions();
    const totalUsers = getTotalUserCount();
    const totalGhosts = sessions.reduce((sum, s) => sum + s.ghostCount, 0);
    return {
        sessionCount: sessions.length,
        totalUsers,
        totalGhosts,
        sessions: sessions.map((s) => ({
            sessionId: s.sessionId,
            roomId: s.roomId,
            participantCount: s.connectedCount,
            phase: s.phase,
        })),
    };
}
// ============================================================================
// HELPERS
// ============================================================================
/**
 * Convert TableState to SessionInfo (public API format)
 */
function createSessionInfo(tableState) {
    const participants = Array.from(tableState.participants.values());
    // Get connected users (have socketId)
    const connectedUsers = participants.filter((p) => p.presence === "CONNECTED" && p.socketId);
    // Get ghost users (disconnected but seat preserved)
    const ghostUsers = participants.filter((p) => p.presence === "GHOST");
    // Extract display names
    const userNames = connectedUsers.map((p) => p.displayName);
    // Extract socketIds (for V1 compatibility)
    const socketIds = connectedUsers
        .map((p) => p.socketId)
        .filter((id) => id !== null);
    // Extract userIds
    const userIds = participants.map((p) => p.userId);
    // Find live speaker
    const liveSpeakerUser = tableState.liveSpeaker
        ? tableState.participants.get(tableState.liveSpeaker)
        : null;
    return {
        sessionId: tableState.sessionId,
        roomId: tableState.roomId,
        users: socketIds,
        userIds,
        userNames,
        phase: tableState.phase,
        isActive: tableState.phase !== "LOBBY" && tableState.phase !== "ENDED",
        createdAt: new Date(tableState.createdAt),
        participantCount: tableState.participants.size,
        connectedCount: connectedUsers.length,
        ghostCount: ghostUsers.length,
        liveSpeaker: tableState.liveSpeaker,
        liveSpeakerName: liveSpeakerUser?.displayName || null,
    };
}
// ============================================================================
// NAMESPACE EXPORT (for convenience)
// ============================================================================
exports.sessionRegistry = {
    getAllSessions,
    getSession,
    getSessionForRoom,
    getUserSession,
    isSessionActive,
    getSessionUsers,
    getSessionCount,
    getTotalUserCount,
    getSessionStats,
};

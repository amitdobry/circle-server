/**
 * Engine V2: Session Registry API
 *
 * Public API for querying session state.
 * V1 socket handlers use this to query V2 as the source of truth.
 *
 * This is the bridge between V1 (imperative) and V2 (event-sourced).
 */

import { roomRegistry } from "../registry/RoomRegistry";
import { TableState, SessionPhase, ParticipantState } from "../state/types";

// ============================================================================
// SESSION INFO (Public API Type)
// ============================================================================

export interface SessionInfo {
  sessionId: string;
  roomId: string;
  users: string[]; // socketIds (for V1 compatibility)
  userIds: string[]; // userIds (primary keys)
  userNames: string[]; // display names
  phase: SessionPhase;
  isActive: boolean;
  createdAt: Date;
  participantCount: number;
  connectedCount: number;
  ghostCount: number;
  liveSpeaker: string | null; // userId
  liveSpeakerName: string | null; // display name
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get all active sessions across all rooms
 */
export function getAllSessions(): SessionInfo[] {
  const rooms = roomRegistry.getAllRooms();
  const sessions: SessionInfo[] = [];

  for (const [_roomId, tableState] of rooms) {
    sessions.push(createSessionInfo(tableState));
  }

  return sessions;
}

/**
 * Get specific session by session ID
 */
export function getSession(sessionId: string): SessionInfo | null {
  const room = roomRegistry.findRoomBySessionId(sessionId);
  return room ? createSessionInfo(room) : null;
}

/**
 * Get session for a specific room
 */
export function getSessionForRoom(roomId: string): SessionInfo | null {
  const room = roomRegistry.getRoom(roomId);
  return room ? createSessionInfo(room) : null;
}

/**
 * Check if user is in any session (by socketId or userId)
 */
export function getUserSession(identifier: string): SessionInfo | null {
  const room = roomRegistry.findUserRoom(identifier);
  return room ? createSessionInfo(room) : null;
}

/**
 * Check if session is active (not in LOBBY or ENDED)
 */
export function isSessionActive(sessionId: string): boolean {
  const session = getSession(sessionId);
  return session ? session.isActive : false;
}

/**
 * Get all users in a session (returns socketIds for V1 compatibility)
 */
export function getSessionUsers(sessionId: string): string[] {
  const session = getSession(sessionId);
  return session ? session.users : [];
}

/**
 * Get session count
 */
export function getSessionCount(): number {
  return getAllSessions().length;
}

/**
 * Get total connected user count across all sessions
 */
export function getTotalUserCount(): number {
  const sessions = getAllSessions();
  return sessions.reduce((sum, s) => sum + s.connectedCount, 0);
}

/**
 * Get session statistics
 */
export function getSessionStats() {
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
function createSessionInfo(tableState: TableState): SessionInfo {
  const participants = Array.from(tableState.participants.values());

  // Get connected users (have socketId)
  const connectedUsers = participants.filter(
    (p) => p.presence === "CONNECTED" && p.socketId,
  );

  // Get ghost users (disconnected but seat preserved)
  const ghostUsers = participants.filter((p) => p.presence === "GHOST");

  // Extract display names
  const userNames = connectedUsers.map((p) => p.displayName);

  // Extract socketIds (for V1 compatibility)
  const socketIds = connectedUsers
    .map((p) => p.socketId)
    .filter((id): id is string => id !== null);

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

export const sessionRegistry = {
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

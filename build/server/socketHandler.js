"use strict";
// socketHandler.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIsSyncPauseMode = getIsSyncPauseMode;
exports.setIsSyncPauseMode = setIsSyncPauseMode;
exports.getPointerMap = getPointerMap;
exports.setPointer = setPointer;
exports.clearPointer = clearPointer;
exports.clearAllPointers = clearAllPointers;
exports.getLiveSpeaker = getLiveSpeaker;
exports.setLiveSpeaker = setLiveSpeaker;
exports.getSessionStats = getSessionStats;
exports.resetSessionState = resetSessionState;
exports.getSessionState = getSessionState;
exports.getUsers = getUsers;
exports.getUserRoomId = getUserRoomId;
exports.globalBroadcastUserList = globalBroadcastUserList;
exports.globalBroadcastAvatarState = globalBroadcastAvatarState;
exports.setupSocketHandlers = setupSocketHandlers;
const avatarManager_1 = require("./avatarManager");
const gestureCatalog_1 = require("./ui-config/gestureCatalog");
const gesture_service_1 = require("./ui-config/gesture.service");
const tableDefinitions_service_1 = require("./ui-config/tableDefinitions.service");
const tableDefinitions_1 = require("./ui-config/tableDefinitions");
const routeAction_1 = require("./actions/routeAction"); // adjust path if needed
const panelConfigService_1 = require("./panelConfigService"); // or wherever you store them
const gliffLogService_1 = require("./gliffLogService");
// Import session logic from BL layer
const sessionLogic_1 = require("./BL/sessionLogic");
// ✨ ENGINE V2: Shadow Mode Integration
const shadowDispatcher_1 = require("./engine-v2/shadow/shadowDispatcher");
const dispatch_1 = require("./engine-v2/reducer/dispatch");
const actionMapper_1 = require("./engine-v2/shadow/actionMapper");
// ✨ ENGINE V2: Speaker Manager (Phase B)
const SpeakerManager_1 = require("./engine-v2/managers/SpeakerManager");
const users = new Map(); // socketId -> { name, avatarId }
// Panel request tracking
const panelRequestCount = new Map(); // userName -> count
const lastPanelRequest = new Map(); // userName -> timestamp
// Socket.IO server instance (set in setupSocketHandlers)
let ioInstance = null;
// ============================================================================
// ❌ DEPRECATED GLOBAL SESSION STATE (Replaced by Engine V2 per-room sessions)
// ============================================================================
// These variables are no longer used. Session state is now managed per-room by:
// - Engine V2 TableState.timer (per-room timer state)
// - Engine V2 TableState.phase (session phase)
// - Engine V2 TableState.sessionId (unique session ID per room)
//
// Left here temporarily for compatibility with legacy code. Will be removed soon.
// ============================================================================
// let sessionActive = false;
// let sessionTimer: NodeJS.Timeout | null = null;
// let sessionStartTime: Date | null = null;
// let sessionDurationMinutes: number = 60; // Default to 60 minutes
// let timerBroadcastInterval: NodeJS.Timeout | null = null;
// let sessionId: string | null = null; // Unique session identifier
// Session utilities
function getSimpleSessionStats() {
    const currentTime = new Date();
    const userCount = users.size;
    const activeUsers = Array.from(users.values())
        .map((u) => u.name)
        .join(", ");
    return {
        userCount,
        activeUsers,
        currentTime: currentTime.toISOString(),
    };
}
function formatSessionLog(message, type = "INFO") {
    const stats = getSimpleSessionStats();
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${type}] ${message} | Users: ${stats.userCount} (${stats.activeUsers || "none"})`;
}
function updateUserActivity(socketId) {
    const user = users.get(socketId);
    if (user) {
        user.lastActivity = new Date();
    }
}
// ============================================================================
// SPEAKER STATE (Engine V2 only)
// ============================================================================
let currentLogInput = ""; // optional state if needed later
/**
 * Get sync pause mode
 */
function getIsSyncPauseMode(roomId = "default-room") {
    return SpeakerManager_1.speakerManager.getSyncPauseMode(roomId);
}
/**
 * Set sync pause mode - supports both legacy and V2
 * @param value - true to enable sync pause
 * @param roomId - Room ID (default: "default-room")
 */
function setIsSyncPauseMode(value, roomId = "default-room") {
    SpeakerManager_1.speakerManager.setSyncPauseMode(roomId, value);
}
/**
 * Get pointer map - supports both legacy and V2
 * @param roomId - Room ID (default: "default-room")
 */
function getPointerMap(roomId = "default-room") {
    return SpeakerManager_1.speakerManager.getPointerMap(roomId);
}
/**
 * Set a pointer - supports both legacy and V2
 * @param fromUser - User who is pointing
 * @param toUser - User being pointed to
 * @param roomId - Room ID (default: "default-room")
 */
function setPointer(fromUser, toUser, roomId = "default-room") {
    SpeakerManager_1.speakerManager.setPointer(roomId, fromUser, toUser);
}
/**
 * Clear a pointer - supports both legacy and V2
 * @param fromUser - User whose pointer to clear
 * @param roomId - Room ID (default: "default-room")
 */
function clearPointer(fromUser, roomId = "default-room") {
    SpeakerManager_1.speakerManager.clearPointer(roomId, fromUser);
}
/**
 * Clear all pointers - supports both legacy and V2
 * @param roomId - Room ID (default: "default-room")
 */
function clearAllPointers(roomId = "default-room") {
    SpeakerManager_1.speakerManager.clearAllPointers(roomId);
}
/**
 * Get live speaker - supports both legacy and V2
 * @param roomId - Room ID (default: "default-room")
 */
function getLiveSpeaker(roomId = "default-room") {
    return SpeakerManager_1.speakerManager.getLiveSpeaker(roomId);
}
/**
 * Set live speaker - supports both legacy and V2
 * @param name - User name (or null to clear)
 * @param roomId - Room ID (default: "default-room")
 */
function setLiveSpeaker(name, roomId = "default-room") {
    SpeakerManager_1.speakerManager.setLiveSpeaker(roomId, name);
}
// ============================================================================
// SESSION STATS (✅ Updated for Engine V2 per-room sessions)
// ============================================================================
function getSessionStats() {
    const currentTime = new Date();
    const userCount = users.size;
    const activeUsers = Array.from(users.values()).map((u) => ({
        name: u.name,
        avatarId: u.avatarId,
        state: u.state,
        joinedAt: u.joinedAt,
        lastActivity: u.lastActivity,
    }));
    // ✅ Get active rooms from Engine V2
    let activeRoomsCount = 0;
    try {
        const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
        const allRooms = roomRegistry.getAllRooms();
        activeRoomsCount = Array.from(allRooms.values()).filter((room) => room.phase !== "LOBBY" && room.phase !== "ENDED").length;
    }
    catch (error) {
        // Non-fatal
    }
    return {
        userCount,
        activeUsers,
        sessionActive: activeRoomsCount > 0, // For backward compatibility
        activeRoomsCount,
    };
}
// ============================================================================
// ❌ DEPRECATED SESSION RESET/STATE (Replaced by Engine V2)
// ============================================================================
// These functions are no longer used. Session state is managed by Engine V2.
// Use RoomRegistry to query/reset room state instead.
// ============================================================================
/*
// Debug function to reset session state
export function resetSessionState() {
  sessionActive = false;
  sessionStartTime = null;
  sessionDurationMinutes = 60;
  sessionId = null;
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
  if (timerBroadcastInterval) {
    clearInterval(timerBroadcastInterval);
    timerBroadcastInterval = null;
  }

  // Clean up all users and release their avatars during reset (releases from all rooms)
  console.log("🔄 Session state manually reset - cleaning up users");
  for (const [socketId, user] of users.entries()) {
    console.log(`🔓 Releasing avatar ${user.avatarId} for user ${user.name}`);
    releaseAvatarByName(user.name); // No roomId = releases from all rooms (reset)
    removeUserFromBL(socketId);
  }

  // Clear all user data
  users.clear();

  // Clear speaker state
  const roomId = "default-room";
  speakerManager.clearAllPointers(roomId);
  speakerManager.setLiveSpeaker(roomId, null);
  speakerManager.setSyncPauseMode(roomId, false);

  console.log("🔄 Session state manually reset");
}

// Session state checker
export function getSessionState() {
  return {
    sessionActive,
    sessionId,
    sessionStartTime,
    sessionDurationMinutes,
    userCount: users.size,
    hasTimer: !!sessionTimer,
    hasBroadcast: !!timerBroadcastInterval,
  };
}
*/
// ✅ NEW: Engine V2 compatible reset function
function resetSessionState() {
    console.log("🔄 Resetting all session state (Engine V2)");
    // Clean up all users
    for (const [socketId, user] of users.entries()) {
        console.log(`🔓 Releasing avatar ${user.avatarId} for user ${user.name}`);
        (0, avatarManager_1.releaseAvatarByName)(user.name);
        (0, sessionLogic_1.removeUser)(socketId);
    }
    users.clear();
    // Reset all rooms in Engine V2
    try {
        const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
        const allRooms = roomRegistry.getAllRooms();
        for (const [roomId] of allRooms) {
            roomRegistry.destroyRoom(roomId);
            console.log(`🔄 Room ${roomId} reset`);
        }
    }
    catch (error) {
        console.error("[V2] Failed to reset rooms:", error);
    }
    console.log("✅ Session state reset complete");
}
// ✅ NEW: Engine V2 compatible state getter
function getSessionState() {
    try {
        const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
        const allRooms = roomRegistry.getAllRooms();
        const roomEntries = Array.from(allRooms.entries());
        const rooms = roomEntries.map((entry) => {
            const [roomId, room] = entry;
            return {
                roomId,
                sessionId: room.sessionId,
                phase: room.phase,
                participantCount: room.participants.size,
                timerActive: room.timer.active,
                timerStartTime: room.timer.startTime,
                timerDurationMs: room.timer.durationMs,
            };
        });
        return {
            userCount: users.size,
            roomCount: rooms.length,
            rooms,
        };
    }
    catch (error) {
        return {
            userCount: users.size,
            roomCount: 0,
            rooms: [],
            error: "Failed to query Engine V2 state",
        };
    }
}
function getUsers(roomId) {
    if (!roomId) {
        // Legacy: return all users
        return users;
    }
    // Phase E: Filter users by room
    const roomUsers = new Map();
    if (!ioInstance) {
        console.warn("[getUsers] ioInstance not initialized, returning empty map");
        return roomUsers;
    }
    for (const [socketId, user] of users.entries()) {
        const userSocket = ioInstance.sockets.sockets.get(socketId);
        if (userSocket?.data?.roomId === roomId) {
            roomUsers.set(socketId, user);
        }
    }
    return roomUsers;
}
/**
 * Get the roomId for a given user by their name
 */
function getUserRoomId(userName) {
    if (!ioInstance) {
        console.warn("[getUserRoomId] ioInstance not initialized");
        return null;
    }
    for (const [socketId, user] of users.entries()) {
        if (user.name === userName) {
            const userSocket = ioInstance.sockets.sockets.get(socketId);
            return userSocket?.data?.roomId || userSocket?.data?.tableId || null;
        }
    }
    return null;
}
// Global broadcast functions for session management
function globalBroadcastUserList(io) {
    const list = Array.from(users.values());
    io.emit("user-list", list);
}
function globalBroadcastAvatarState(io) {
    io.emit("avatars", (0, avatarManager_1.getAvailableAvatars)());
}
// ============================================================================
// ❌ DEPRECATED SESSION FUNCTIONS (Replaced by Engine V2)
// ============================================================================
// These functions are no longer used. Session management is now handled by:
// - Engine V2 reducer (state transitions)
// - Engine V2 effects (timer management)
// - Per-room session isolation (not global)
//
// Left here for reference only. Will be removed in future cleanup.
// ============================================================================
/*
// Session start function with configurable duration
function startSessionWithDuration(io: Server, durationMinutes: number = 60) {
  if (sessionActive) {
    console.log(
      `⚠️ Attempted to start session but one is already active (ID: ${sessionId})`,
    );
    return;
  }

  sessionActive = true;
  sessionStartTime = new Date();
  sessionDurationMinutes = durationMinutes;
  sessionId = `session_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  console.log(
    `🚀 Session started (ID: ${sessionId}) - ${durationMinutes} minute timer begins`,
  );

  // Set timer for specified duration
  sessionTimer = setTimeout(
    () => {
      endSession(io);
    },
    durationMinutes * 60 * 1000,
  ); // Convert minutes to milliseconds

  // Start broadcasting timer updates every second
  startTimerBroadcast(io);

  // Notify all users session has started
  io.emit("session-started-broadcast", {
    sessionId,
    durationMinutes,
    startTime: sessionStartTime.toISOString(),
    message: `Session started for ${durationMinutes} minutes`,
  });
}

// Simple session start function (60 minutes default)
function startSession(io: Server) {
  startSessionWithDuration(io, 60);
}

function endSession(io: Server) {
  sessionActive = false;
  sessionStartTime = null;
  sessionDurationMinutes = 60; // Reset to default
  console.log("⏰ Session ended - navigating users to home page");

  // Stop timer broadcasts
  if (timerBroadcastInterval) {
    clearInterval(timerBroadcastInterval);
    timerBroadcastInterval = null;
  }

  // Clear the gliff log when session ends (legacy - default room only)
  clearGliffLog(io, "default-room");

  // Clean up all users and release their avatars (legacy - releases from all rooms)
  console.log("🧹 Cleaning up all users and releasing avatars");
  for (const [socketId, user] of users.entries()) {
    console.log(`🔓 Releasing avatar ${user.avatarId} for user ${user.name}`);
    releaseAvatarByName(user.name); // No roomId = releases from all rooms (legacy)
    removeUserFromBL(socketId);
  }

  // Clear all user data
  users.clear();
  clearAllPointers("default-room");
  setLiveSpeaker(null, "default-room");
  setIsSyncPauseMode(false, "default-room");

  // Reset V2 room state so new session starts clean
  try {
    const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
    roomRegistry.destroyRoom("default-room");
    console.log("[V2] Room 'default-room' reset for new session");
  } catch (e) {
    // Non-fatal
  }

  // Notify all users session is ending and to navigate home
  io.emit("session-ended", {
    message: "Session has ended. Thank you for participating!",
    navigateToHome: true,
    countdown: 3, // Give users 3 seconds to see the message
  });

  // Give users a moment to see the message, then force navigation
  setTimeout(() => {
    io.emit("force-navigate-home", {
      message: "Redirecting to home page...",
      reason: "session-ended",
    });
    console.log("🏠 Navigation to home page triggered for all users");

    // Broadcast clean state to any remaining connections
    globalBroadcastUserList(io);
    globalBroadcastAvatarState(io);
  }, 3000);

  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

// Timer broadcast function
function startTimerBroadcast(io: Server) {
  // Clear any existing timer broadcast
  if (timerBroadcastInterval) {
    clearInterval(timerBroadcastInterval);
  }

  // Broadcast timer updates every second
  timerBroadcastInterval = setInterval(() => {
    if (!sessionActive || !sessionStartTime) {
      if (timerBroadcastInterval) {
        clearInterval(timerBroadcastInterval);
        timerBroadcastInterval = null;
      }
      return;
    }

    const currentTime = new Date();
    const elapsedSeconds = Math.floor(
      (currentTime.getTime() - sessionStartTime.getTime()) / 1000,
    );
    const totalSeconds = sessionDurationMinutes * 60; // Use stored duration in seconds
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

    const remainingMinutes = Math.floor(remainingSeconds / 60);
    const remainingSecondsDisplay = remainingSeconds % 60;

    // Emit timer update to all connected clients
    io.emit("session-timer", {
      remainingSeconds,
      remainingMinutes,
      remainingSecondsDisplay,
      totalSeconds,
      elapsedSeconds,
      isActive: sessionActive,
    });

    // Auto-end session if time is up (safety check)
    if (remainingSeconds <= 0) {
      endSession(io);
    }
  }, 1000);
}
*/
function setupSocketHandlers(io) {
    // Store io instance for module-level functions (Phase E multi-table)
    ioInstance = io;
    // ✨ ENGINE V2: Enable Shadow Mode if environment variable is set
    if (process.env.ENGINE_V2_SHADOW === "true") {
        (0, shadowDispatcher_1.enableShadowMode)();
        console.log("[Server] ✨ Engine V2 shadow mode ENABLED - V2 running as passive observer");
    }
    io.on("connection", (socket) => {
        console.log(formatSessionLog(`🪪 New socket connection: ${socket.id}`, "INFO"));
        socket.on("joined-table", ({ name }) => {
            const avatar = users.get(socket.id)?.avatarId;
            const roomId = socket.data.roomId || socket.data.tableId;
            console.log(`[Server] 🔔 'joined-table' received from socket ${socket.id}, name: ${name}, room: ${roomId}`);
            const emoji = avatarManager_1.emojiLookup[avatar || ""] || "";
            emitSystemLog(`🪑 ${emoji} ${name} has fully entered the table`, roomId);
            sendCurrentUserListTo(socket); // send only to this socket
        });
        function sendCurrentUserListTo(socket) {
            // Get the user's roomId and send room-filtered list
            const roomId = socket.data.roomId || socket.data.tableId;
            if (roomId) {
                // ✅ FIX: Read from V2 to include ghosts (same as broadcastUserList)
                const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
                const roomState = roomRegistry.getRoom(roomId);
                if (roomState && roomState.participants.size > 0) {
                    // Build user list from V2 participants (includes CONNECTED + GHOST)
                    const roomUsers = Array.from(roomState.participants.values()).map((participant) => ({
                        name: participant.displayName,
                        avatarId: participant.avatarId,
                        state: participant.presence === "GHOST" ? "ghost" : "regular",
                        presence: participant.presence,
                        interruptedBy: "",
                        joinedAt: new Date(participant.lastSeen || Date.now()),
                        lastActivity: new Date(participant.lastSeen || Date.now()),
                    }));
                    console.log(`🔍 [sendCurrentUserListTo] Sending ${roomUsers.length} users (V2) from room ${roomId} to socket ${socket.id}`);
                    console.log(`   Including: ${roomUsers.map((u) => `${u.name}${u.presence === "GHOST" ? "👻" : ""}`).join(", ")}`);
                    socket.emit("user-list", roomUsers);
                }
                else {
                    // Fallback to V1 if no V2 state
                    const roomUsersMap = getUsers(roomId);
                    const roomUsers = Array.from(roomUsersMap.values());
                    console.log(`🔍 [sendCurrentUserListTo] Sending ${roomUsers.length} users (V1 fallback) from room ${roomId} to socket ${socket.id}`);
                    socket.emit("user-list", roomUsers);
                }
            }
            else {
                // Fallback to global list if no room assigned (shouldn't happen in multi-table mode)
                const list = Array.from(users.values());
                console.warn(`⚠️ [sendCurrentUserListTo] No roomId for socket ${socket.id}, sending global list (${list.length} users)`);
                socket.emit("user-list", list);
            }
        }
        socket.on("request-join", ({ userId, name, avatarId, tableId }) => {
            // Use client-provided userId (stable UUID) or fallback to socket.id for legacy clients
            const effectiveUserId = userId || socket.id;
            console.log(formatSessionLog(`📨 Join request: ${name} as ${avatarId} → table: ${tableId || "default-room"} (socket: ${socket.id}, userId: ${effectiveUserId})`, "INFO"));
            // ✅ Validate tableId if provided
            if (tableId && !(0, tableDefinitions_1.isValidTableId)(tableId)) {
                console.log(formatSessionLog(`🚫 Join rejected: Invalid tableId "${tableId}"`, "ERROR"));
                socket.emit("join-rejected", {
                    reason: `Invalid table. Please choose a valid circle.`,
                });
                return;
            }
            // Store user data in socket for disconnect handling and V2
            const resolvedTableId = tableId || "default-room";
            socket.data.roomId = resolvedTableId;
            socket.data.tableId = resolvedTableId;
            socket.data.userName = name; // Phase E: Store for disconnect logging
            socket.data.avatarId = avatarId; // Phase E: Store for disconnect logging
            socket.data.userId = effectiveUserId; // Ghost Mode: Store stable userId
            console.log(formatSessionLog(`📌 Assigned socket to table: ${resolvedTableId}`, "INFO"));
            console.log(`🔍 [JOIN DEBUG] Socket ${socket.id} data:`, {
                roomId: socket.data.roomId,
                tableId: socket.data.tableId,
                name: name,
                avatar: avatarId,
            });
            // 🔥 CRITICAL: Join the Socket.IO room for this table
            socket.join(resolvedTableId);
            console.log(formatSessionLog(`🚪 Socket joined room: ${resolvedTableId}`, "INFO"));
            // Verify the join
            const socketRooms = Array.from(socket.rooms);
            console.log(`🔍 [JOIN DEBUG] Socket ${socket.id} is now in rooms:`, socketRooms);
            if (!name || name.length > 30) {
                console.log(formatSessionLog(`🚫 Join rejected: Invalid name "${name}"`, "ERROR"));
                socket.emit("join-rejected", { reason: "Invalid name." });
                return;
            }
            // Phase E: Check for duplicate name WITHIN THIS ROOM (V1 + V2 ghosts)
            const roomUsersMap = getUsers(resolvedTableId);
            console.log(`🔍 [NAME CHECK] Checking name "${name}" in room "${resolvedTableId}"`);
            console.log(`🔍 [NAME CHECK] Found ${roomUsersMap.size} users in this room:`, Array.from(roomUsersMap.values()).map((u) => u.name));
            let nameAlreadyTaken = Array.from(roomUsersMap.values()).some((user) => user.name.toLowerCase() === name.toLowerCase());
            // Also check V2 ghost participants (keep their names locked)
            if (!nameAlreadyTaken) {
                try {
                    const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
                    const roomState = roomRegistry.getRoom(resolvedTableId);
                    if (roomState && roomState.participants) {
                        for (const [, participant] of roomState.participants) {
                            if (participant.presence === "GHOST" &&
                                participant.displayName.toLowerCase() === name.toLowerCase()) {
                                nameAlreadyTaken = true;
                                console.log(`🔍 [NAME CHECK] Name "${name}" is taken by a GHOST user`);
                                break;
                            }
                        }
                    }
                }
                catch (error) {
                    // V2 not available, continue with V1 only
                }
            }
            if (nameAlreadyTaken) {
                console.log(formatSessionLog(`🚫 Join rejected: Name "${name}" already taken in room ${resolvedTableId}`, "ERROR"));
                socket.emit("join-rejected", {
                    reason: "Name already taken in this table. Please choose another.",
                });
                return;
            }
            // Phase E: Try to claim the avatar WITHIN THIS ROOM
            const claimed = (0, avatarManager_1.claimAvatar)(avatarId, name, resolvedTableId);
            if (!claimed) {
                console.log(formatSessionLog(`🚫 Join rejected: Avatar ${avatarId} already taken in room ${resolvedTableId}`, "ERROR"));
                socket.emit("join-rejected", {
                    reason: "Avatar already taken in this table. Please choose another.",
                });
                return;
            }
            // ✅ All good: Save user and broadcast
            const joinTime = new Date();
            users.set(socket.id, {
                name,
                avatarId,
                state: "regular",
                interruptedBy: "",
                joinedAt: joinTime,
                lastActivity: joinTime,
            });
            // Add user to session logic tracking
            (0, sessionLogic_1.addUser)(socket.id, {
                name,
                avatarId,
                state: "regular",
                interruptedBy: "",
                joinedAt: joinTime,
                lastActivity: joinTime,
            });
            (0, sessionLogic_1.addTableUser)(socket.id);
            const emoji = avatarManager_1.emojiLookup[avatarId] || "";
            console.log(formatSessionLog(`✅ ${emoji} ${name} joined table as ${avatarId}`, "JOIN"));
            emitSystemLog(`👤 ${emoji} ${name} joined table as ${avatarId}`, resolvedTableId);
            socket.emit("join-approved", { name, avatarId });
            // Give client time to set up event listeners, then check for session picker
            setTimeout(() => {
                // ✅ Check room-specific session state (not global)
                try {
                    const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
                    const roomState = roomRegistry.getOrCreateRoom(resolvedTableId);
                    // Count users in THIS ROOM only
                    const roomUsers = Array.from(users.values()).filter((u) => {
                        const userSocket = io.sockets.sockets.get(Array.from(users.entries()).find(([, val]) => val === u)?.[0] ||
                            "");
                        return userSocket?.data?.roomId === resolvedTableId;
                    });
                    const isFirstUserInRoom = roomUsers.length === 1;
                    const noActiveSession = roomState.phase === "LOBBY";
                    console.log(`🔍 Session check for ${name} in room ${resolvedTableId} (after delay):`);
                    console.log(`  - isFirstUserInRoom: ${isFirstUserInRoom} (room users: ${roomUsers.length})`);
                    console.log(`  - noActiveSession: ${noActiveSession} (phase: ${roomState.phase})`);
                    console.log(`  - sessionId: ${roomState.sessionId}`);
                    console.log(`  - socket.connected: ${socket.connected}`);
                    if (isFirstUserInRoom && noActiveSession) {
                        console.log(`🎯 TRIGGERING session picker for first user in room ${resolvedTableId}: ${name}`);
                        // Send session picker to this specific user
                        socket.emit("show-session-picker", {
                            message: "As the first user, please choose the session length.",
                            options: [60, 30, 15, 5], // Available durations in minutes
                            allowCustom: true, // Allow free pick
                            isFirstUser: true,
                            timestamp: new Date().toISOString(),
                        });
                        console.log(`📤 Session picker sent to ${name} (socket: ${socket.id})`);
                        // Also emit to room as a fallback
                        io.to(resolvedTableId).emit("debug-session-picker-status", {
                            target: name,
                            triggered: true,
                            reason: "First user joined room, no active session",
                        });
                    }
                    else {
                        console.log(`🚫 Session picker NOT shown for ${name}:`);
                        if (!isFirstUserInRoom)
                            console.log(`  - Reason: Not first user in room (${roomUsers.length} users in ${resolvedTableId})`);
                        if (!noActiveSession)
                            console.log(`  - Reason: Session already active in room (ID: ${roomState.sessionId})`);
                        // Emit debug info to room
                        io.to(resolvedTableId).emit("debug-session-picker-status", {
                            target: name,
                            triggered: false,
                            reason: !isFirstUserInRoom
                                ? `Not first user in room (${roomUsers.length} total)`
                                : `Session already active (${roomState.sessionId})`,
                        });
                    }
                }
                catch (error) {
                    console.error("[V2] Failed to check session state for picker:", error);
                }
            }, 500); // 500ms delay to ensure client is ready
            // ✨ ENGINE V2: Dispatch with effects FIRST
            try {
                const roomId = (0, actionMapper_1.extractRoomId)(socket, { name, avatarId });
                const userId = effectiveUserId; // Use stable userId from client or socket.id
                const action = (0, actionMapper_1.mapLegacyToV2Action)("request-join", {
                    name,
                    avatarId,
                    socketId: socket.id,
                });
                (0, dispatch_1.dispatchAndRun)(roomId, userId, action, io);
                // Debug: Print full room state after join
                const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
                roomRegistry.debugPrintAllRooms();
            }
            catch (error) {
                console.error("[V2] Failed on request-join:", error);
            }
            // ✅ Now broadcast AFTER V2 is updated
            broadcastUserList(resolvedTableId); // Pass roomId
            broadcastAvatarState(resolvedTableId); // Phase E: Room-scoped avatar broadcast
            sendInitialPointerMap(socket, resolvedTableId); // Pass roomId
            sendCurrentLiveSpeaker(socket, resolvedTableId); // Pass roomId
        });
        // 🔄 Handle Ghost Mode reconnection
        socket.on("request-reconnect", ({ userId, tableId }) => {
            console.log(formatSessionLog(`🔄 Reconnect request: userId=${userId}, table=${tableId} (socket: ${socket.id})`, "INFO"));
            if (!userId || !tableId) {
                socket.emit("reconnect-failed", {
                    reason: "Missing userId or tableId",
                });
                return;
            }
            try {
                const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
                const roomState = roomRegistry.getRoom(tableId);
                if (!roomState) {
                    console.log(formatSessionLog(`🚫 Reconnect failed: Room ${tableId} not found`, "ERROR"));
                    socket.emit("reconnect-failed", {
                        reason: "Table not found or session expired",
                    });
                    return;
                }
                const participant = roomState.participants.get(userId);
                if (!participant) {
                    console.log(formatSessionLog(`🚫 Reconnect failed: User ${userId} not found in room ${tableId}`, "ERROR"));
                    socket.emit("reconnect-failed", {
                        reason: "Session expired. Please join again.",
                    });
                    return;
                }
                if (participant.presence !== "GHOST") {
                    console.log(formatSessionLog(`🚫 Reconnect failed: User ${userId} is ${participant.presence}, not GHOST`, "ERROR"));
                    socket.emit("reconnect-failed", {
                        reason: "Already connected from another tab",
                    });
                    return;
                }
                // ✅ Use V2 reducer to handle reconnection (no direct mutation!)
                const reconnectAction = (0, actionMapper_1.mapLegacyToV2Action)("reconnect", {
                    displayName: participant.displayName,
                    socketId: socket.id,
                });
                // ✅ Pass socket.id (not userId) - reducer updates participant.socketId
                (0, dispatch_1.dispatchAndRun)(tableId, socket.id, reconnectAction, io);
                // Update socket data
                socket.data.userId = userId;
                socket.data.roomId = tableId;
                socket.data.tableId = tableId;
                socket.data.userName = participant.displayName;
                socket.data.avatarId = participant.avatarId;
                // Join socket room
                socket.join(tableId);
                // Update V1 state for backward compatibility
                users.set(socket.id, {
                    name: participant.displayName,
                    avatarId: participant.avatarId,
                    state: "regular",
                    interruptedBy: "",
                    joinedAt: new Date(),
                    lastActivity: new Date(),
                });
                // ✅ Reclaim avatar in V1 assignments
                (0, avatarManager_1.claimAvatar)(participant.avatarId, participant.displayName, tableId);
                console.log(formatSessionLog(`✅ Reconnect successful: ${participant.displayName} (${userId}) back in ${tableId}`, "INFO"));
                // Re-fetch room state after dispatch (reducer updated it)
                const updatedRoomState = roomRegistry.getRoom(tableId);
                // Send success with snapshot
                socket.emit("reconnect-success", {
                    roomId: tableId,
                    tableId: tableId,
                    phase: updatedRoomState.phase,
                    me: {
                        userId,
                        displayName: participant.displayName,
                        avatarId: participant.avatarId,
                        presence: "CONNECTED",
                    },
                    participants: Array.from(updatedRoomState.participants.entries()).map(([id, p]) => ({
                        userId: id,
                        displayName: p.displayName,
                        avatarId: p.avatarId,
                        presence: p.presence,
                    })),
                    liveSpeakerUserId: roomState.liveSpeaker,
                });
                // Broadcast updates
                broadcastUserList(tableId);
                broadcastAvatarState(tableId);
                sendCurrentLiveSpeaker(socket, tableId);
                sendInitialPointerMap(socket, tableId);
                // ✅ REBUILD_ALL_PANELS effect is already returned by reducer
                // No need to call manually here
                emitSystemLog(`🔄 ${participant.displayName} reconnected`, tableId);
            }
            catch (error) {
                console.error("[V2] Failed on reconnect:", error);
                socket.emit("reconnect-failed", {
                    reason: "Server error during reconnection",
                });
            }
        });
        // Handle session start request from first user (✅ Engine V2 per-room sessions)
        socket.on("start-session", ({ durationMinutes }) => {
            const user = users.get(socket.id);
            if (!user) {
                socket.emit("session-start-rejected", {
                    reason: "User not found",
                });
                return;
            }
            // Validate duration
            if (!durationMinutes || durationMinutes <= 0 || durationMinutes > 120) {
                socket.emit("session-start-rejected", {
                    reason: "Invalid duration. Please choose between 1-120 minutes.",
                });
                return;
            }
            // ✅ Get room ID from socket data
            const roomId = socket.data.roomId || socket.data.tableId || "default-room";
            // ✅ Check if session is already active in THIS ROOM (not global)
            try {
                const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
                const roomState = roomRegistry.getOrCreateRoom(roomId);
                // Check if session already active in this room
                if (roomState.phase !== "LOBBY") {
                    socket.emit("session-start-rejected", {
                        reason: "Session already active in this table",
                    });
                    return;
                }
                console.log(`🎯 ${user.name} started ${durationMinutes}-minute session in room ${roomId}`);
                // ✅ Dispatch to Engine V2 (this handles everything)
                const userId = socket.data.userId || socket.id; // Use stored userId
                const action = (0, actionMapper_1.mapLegacyToV2Action)("start-session", {
                    durationMinutes,
                });
                (0, dispatch_1.dispatchAndRun)(roomId, userId, action, io);
            }
            catch (error) {
                console.error("[V2] Failed on start-session:", error);
                socket.emit("session-start-rejected", {
                    reason: "Internal error starting session",
                });
            }
        });
        socket.on("clientEmits", ({ name, type, subType, actionType, targetUser, flavor }) => {
            const user = users.get(socket.id);
            if (!user) {
                console.warn(`🛑 Rejected clientEmits — unknown socket ${socket.id}`);
                return;
            }
            updateUserActivity(socket.id);
            if (!["ear", "brain", "mouth", "mic", "blue"].includes(type)) {
                console.warn(`🌀 Invalid ListenerEmit type: ${type}`);
                return;
            }
            const roomId = socket.data.roomId || socket.data.tableId || "default-room";
            (0, routeAction_1.routeAction)({ name, type, subType, actionType, targetUser, flavor }, {
                io,
                logSystem: (text) => emitSystemLog(text, roomId),
                logAction: (text) => emitActionLog(text, roomId),
                pointerMap: getPointerMap(),
                gestureCatalog: gestureCatalog_1.gestureCatalog,
                socketId: socket.id,
                roomId,
                users,
            });
        });
        socket.on("leave", ({ name, tableId }, callback) => {
            const user = users.get(socket.id);
            const roomId = tableId || socket.data.roomId || socket.data.tableId;
            if (user) {
                const sessionDuration = Math.floor((new Date().getTime() - user.joinedAt.getTime()) / 1000);
                console.log(formatSessionLog(`👋 ${name} left manually (was in session ${Math.floor(sessionDuration / 60)}m${sessionDuration % 60}s)`, "LEAVE"));
            }
            else {
                console.log(formatSessionLog(`👋 ${name} left manually (no session data)`, "LEAVE"));
            }
            // ✨ ENGINE V2: Dispatch LEAVE_SESSION with effects
            try {
                // ✅ Pass socket.id (not userId) - reducer searches by socketId
                const action = (0, actionMapper_1.mapLegacyToV2Action)("leave", { name });
                (0, dispatch_1.dispatchAndRun)(roomId, socket.id, action, io);
                // ✅ Broadcast updated user list
                if (roomId) {
                    broadcastUserList(roomId);
                    broadcastAvatarState(roomId);
                }
                // 📜 V1 fallback cleanup (for any V1 state)
                cleanupUser(socket);
                // ✅ Send acknowledgment to client
                callback?.({ success: true });
            }
            catch (error) {
                console.error("[V2] Failed on leave:", error);
                // ❌ Send error acknowledgment
                callback?.({ success: false, error: String(error) });
            }
        });
        socket.on("disconnect", () => {
            // Phase E: Get user info from Map first, fallback to socket.data
            const user = users.get(socket.id);
            const roomId = socket.data.roomId || socket.data.tableId;
            const userName = user?.name || socket.data.userName || "Unknown";
            const avatarId = user?.avatarId || socket.data.avatarId;
            if (user) {
                const sessionDuration = Math.floor((new Date().getTime() - user.joinedAt.getTime()) / 1000);
                console.log(formatSessionLog(`❌ ${user.name} disconnected unexpectedly (was in session ${Math.floor(sessionDuration / 60)}m${sessionDuration % 60}s)`, "LEAVE"));
            }
            else if (socket.data.userName) {
                // User was already cleaned up, but we have socket.data backup
                console.log(formatSessionLog(`❌ ${socket.data.userName} disconnected (already cleaned up)`, "LEAVE"));
            }
            else {
                console.log(formatSessionLog(`❌ Unknown socket ${socket.id} disconnected (no user data)`, "ERROR"));
            }
            // Always emit system log with best available name
            const emoji = avatarId ? avatarManager_1.emojiLookup[avatarId] || "" : "";
            emitSystemLog(`❌ ${emoji} ${userName} disconnected`, roomId);
            // ✨ ENGINE V2: Dispatch FIRST (before cleanup destroys state)
            try {
                const extractedRoomId = (0, actionMapper_1.extractRoomId)(socket, {});
                // Only process V2 disconnect if user was actually in a real table
                // Skip "default-room" to prevent ghost tables
                if (extractedRoomId && extractedRoomId !== "default-room" && user) {
                    const action = (0, actionMapper_1.mapLegacyToV2Action)("disconnect", {});
                    // Pass socket.id as userId parameter - reducer expects current socketId
                    (0, dispatch_1.dispatchAndRun)(extractedRoomId, socket.id, action, io);
                    // ✅ Broadcast updated user list (includes ghosts)
                    broadcastUserList(extractedRoomId);
                    broadcastAvatarState(extractedRoomId);
                }
            }
            catch (error) {
                console.error("[V2] Failed on disconnect:", error);
            }
            // 📜 V1 fallback cleanup (AFTER V2 processes)
            // This only cleans V1 state, V2 state is managed by reducer
            cleanupUser(socket);
        });
        socket.on("pointing", ({ from, to }) => {
            updateUserActivity(socket.id);
            console.log("[Client] Emitting pointing to:", from, to);
            const roomIdPointing = socket.data.roomId || socket.data.tableId || "default-room";
            (0, routeAction_1.routeAction)({
                from,
                type: "pointing",
                subType: "manual",
                actionType: "pointAtSpeaker",
                to,
            }, {
                io,
                logSystem: (text) => emitSystemLog(text, roomIdPointing),
                logAction: (text) => emitActionLog(text, roomIdPointing),
                pointerMap: getPointerMap(),
                gestureCatalog: gestureCatalog_1.gestureCatalog,
                socketId: socket.id,
                roomId: roomIdPointing,
                users,
            });
            // ✨ ENGINE V2: Dispatch with effects
            try {
                const roomId = (0, actionMapper_1.extractRoomId)(socket, { from, to });
                const userId = socket.data.userId || socket.id; // Use stored userId
                const action = (0, actionMapper_1.mapLegacyToV2Action)("pointing", { from, to });
                (0, dispatch_1.dispatchAndRun)(roomId, userId, action, io);
            }
            catch (error) {
                console.error("[V2] Failed on pointing:", error);
            }
        });
        socket.on("logBar:update", ({ text, userName }) => {
            const user = users.get(socket.id);
            if (!user) {
                console.log(`🚫 Rejected logBar:update — unknown user (${socket.id})`);
                return;
            }
            updateUserActivity(socket.id);
            // Phase E: Use actual room ID
            const roomId = socket.data.roomId || socket.data.tableId || "default-room";
            const currentSpeaker = getLiveSpeaker(roomId);
            if (user.name !== currentSpeaker) {
                console.log(`🚫 Rejected logBar:update — ${user.name} is not live in room ${roomId} (liveSpeaker=${currentSpeaker})`);
                return;
            }
            console.log(`📡 [Room ${roomId}] logBar:update from ${user.name}:`, text);
            (0, gliffLogService_1.createGliffLog)({
                userName,
                message: {
                    messageType: "textInput",
                    content: text,
                    timestamp: Date.now(),
                },
            }, io, roomId);
        });
        // Optional P2P (currently dormant)
        socket.on("peer-signal", ({ to, from, signal }) => {
            for (const [socketId, name] of users.entries()) {
                if (name === to) {
                    io.to(socketId).emit("peer-signal", { from, signal });
                    break;
                }
            }
        });
        socket.on("request:gestureButtons", () => {
            console.log("[Server] Received request:gestureButtons");
            const buttons = (0, gesture_service_1.getAllGestureButtons)();
            socket.emit("receive:gestureButtons", buttons);
        });
        socket.on("request:tableDefinitions", () => {
            // Reduced logging - only log once per socket
            if (!socket.data.hasRequestedTableDefs) {
                console.log(`[Server] First table definitions request from socket ${socket.id}`);
                socket.data.hasRequestedTableDefs = true;
            }
            const tables = (0, tableDefinitions_service_1.getAllTableDefinitions)();
            socket.emit("receive:tableDefinitions", tables);
        });
        socket.on("request:panelConfig", ({ userName }) => {
            if (!userName) {
                console.warn("⚠️ No userName provided in request:panelConfig");
                return;
            }
            // Track panel request frequency
            const now = Date.now();
            const currentCount = (panelRequestCount.get(userName) || 0) + 1;
            const lastRequest = lastPanelRequest.get(userName) || 0;
            const timeSinceLastRequest = now - lastRequest;
            panelRequestCount.set(userName, currentCount);
            lastPanelRequest.set(userName, now);
            console.log(formatSessionLog(`🛠️ [PANEL-DEBUG] Building panel config for ${userName} (socket: ${socket.id}) | Request #${currentCount} | ${timeSinceLastRequest}ms since last`, "INFO"));
            const config = (0, panelConfigService_1.getPanelConfigFor)(userName);
            console.log(formatSessionLog(`🛠️ [PANEL-DEBUG] Sending panel config to ${userName} (socket: ${socket.id})`, "INFO"));
            socket.emit("receive:panelConfig", config);
        });
        // ========================================================================
        // ENGINE V2: Session Registry Handlers (Phase 1A)
        // ========================================================================
        socket.on("get-sessions", () => {
            console.log(`[Server] 📊 get-sessions request from ${socket.id}`);
            try {
                // Import session registry API
                const { sessionRegistry } = require("./engine-v2/api/sessionRegistry");
                const sessions = sessionRegistry.getAllSessions();
                console.log(`[Server] 📊 Returning ${sessions.length} active session(s)`);
                socket.emit("sessions-list", {
                    sessions,
                    timestamp: Date.now(),
                });
            }
            catch (error) {
                console.error("[Server] ❌ Error fetching sessions:", error);
                socket.emit("sessions-list", {
                    sessions: [],
                    error: "Failed to fetch sessions",
                    timestamp: Date.now(),
                });
            }
        });
        socket.on("check-session", ({ userId }) => {
            if (!userId) {
                console.warn("⚠️ No userId provided in check-session");
                socket.emit("session-status", {
                    inSession: false,
                    error: "userId required",
                });
                return;
            }
            try {
                const { sessionRegistry } = require("./engine-v2/api/sessionRegistry");
                const sessionInfo = sessionRegistry.getUserSession(userId);
                if (sessionInfo) {
                    socket.emit("session-status", {
                        inSession: true,
                        session: sessionInfo,
                    });
                }
                else {
                    socket.emit("session-status", {
                        inSession: false,
                    });
                }
            }
            catch (error) {
                console.error("[Server] ❌ Error checking session:", error);
                socket.emit("session-status", {
                    inSession: false,
                    error: "Failed to check session",
                });
            }
        });
        socket.on("admin-end-session", ({ sessionId, adminId }) => {
            if (!sessionId) {
                console.warn("⚠️ No sessionId provided in admin-end-session");
                socket.emit("admin-end-session-result", {
                    success: false,
                    error: "sessionId required",
                });
                return;
            }
            console.log(`[Server] 🛑 admin-end-session: Session ${sessionId} by admin ${adminId || "unknown"}`);
            try {
                // Import dispatch and action types
                const { dispatch } = require("./engine-v2/reducer/dispatch");
                const { sessionRegistry } = require("./engine-v2/api/sessionRegistry");
                // Get room ID for this session
                const sessionInfo = sessionRegistry.getSession(sessionId);
                if (!sessionInfo) {
                    console.warn(`⚠️ Session ${sessionId} not found`);
                    socket.emit("admin-end-session-result", {
                        success: false,
                        error: "Session not found",
                    });
                    return;
                }
                // Dispatch ADMIN_END_SESSION action to V2
                dispatch(sessionInfo.roomId, null, {
                    type: "ADMIN_END_SESSION",
                    payload: { adminId, sessionId },
                });
                console.log(`[Server] ✅ admin-end-session dispatched for session ${sessionId}`);
                socket.emit("admin-end-session-result", {
                    success: true,
                    sessionId,
                });
                // Broadcast to all clients that session was terminated
                io.emit("session-terminated", {
                    sessionId,
                    reason: "admin-terminated",
                    adminId,
                });
            }
            catch (error) {
                console.error("[Server] ❌ Error ending session:", error);
                socket.emit("admin-end-session-result", {
                    success: false,
                    error: "Failed to end session",
                });
            }
        });
        // ========================================================================
        // END ENGINE V2 Session Registry Handlers
        // ========================================================================
        // Request: list of avatars (Phase E: room-scoped)
        socket.on("get-avatars", (payload) => {
            // Priority: payload.tableId → socket.data → default
            const roomId = payload?.tableId ||
                socket.data?.roomId ||
                socket.data?.tableId ||
                "default-room";
            const roomAvatars = (0, avatarManager_1.getAvailableAvatars)(roomId);
            console.log(`🎨 [get-avatars] Sending ${roomAvatars.length} avatars for room ${roomId} to socket ${socket.id}`);
            socket.emit("avatars", roomAvatars);
        });
        function cleanupUser(socket) {
            const user = users.get(socket.id);
            if (!user)
                return;
            // Get room ID before cleanup
            const userRoomId = socket.data?.roomId || socket.data?.tableId || "default-room";
            users.delete(socket.id);
            // Also remove from session logic tracking
            (0, sessionLogic_1.removeUser)(socket.id);
            clearPointer(user.name, userRoomId); // Pass roomId
            (0, avatarManager_1.releaseAvatarByName)(user.name, userRoomId); // Phase E: Release avatar from specific room
            setIsSyncPauseMode(false, userRoomId); // Pass roomId
            // Clear any pointers TO this user in their room
            const currentPointers = getPointerMap(userRoomId);
            for (const [from, to] of currentPointers.entries()) {
                if (to === user.name)
                    clearPointer(from, userRoomId);
            }
            // Count users in this specific room
            const roomUserCount = Array.from(users.entries()).filter(([socketId, _]) => {
                const userSocket = io.sockets.sockets.get(socketId);
                return userSocket?.data?.roomId === userRoomId;
            }).length;
            // ✅ Phase E: End session for THIS ROOM ONLY if last user left
            if (roomUserCount === 0) {
                console.log(`🔄 Last user left room ${userRoomId}`);
                try {
                    const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
                    const roomState = roomRegistry.getRoom(userRoomId);
                    // Only end session if one was active in this room
                    if (roomState &&
                        roomState.phase !== "LOBBY" &&
                        roomState.phase !== "ENDED") {
                        console.log(`🔄 Ending session for room ${userRoomId} (all users left)`);
                        // ✅ Dispatch END_SESSION for THIS ROOM ONLY
                        const { ActionTypes } = require("./engine-v2/actions/actionTypes");
                        (0, dispatch_1.dispatchAndRun)(userRoomId, null, {
                            type: ActionTypes.END_SESSION,
                            payload: { reason: "all-users-left" },
                        }, io);
                    }
                    else {
                        console.log(`ℹ️ Room ${userRoomId} empty but no active session to end`);
                    }
                }
                catch (error) {
                    console.error("[V2] Failed to end session for empty room:", error);
                }
            }
            broadcastUserList(userRoomId); // Pass roomId
            broadcastAvatarState(userRoomId); // Phase E: Room-scoped avatar broadcast
        }
        function broadcastUserList(roomId) {
            if (roomId) {
                // Room-specific broadcast - use V2 participants (includes ghosts)
                console.log(`\n🔍 [broadcastUserList] Fetching from V2 for room: ${roomId}`);
                const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
                const roomState = roomRegistry.getRoom(roomId);
                if (roomState && roomState.participants.size > 0) {
                    // Build user list from V2 participants (includes CONNECTED + GHOST)
                    const roomUsers = Array.from(roomState.participants.values()).map((participant) => ({
                        name: participant.displayName,
                        avatarId: participant.avatarId, // ✅ Keep original avatar, UI derives ghost appearance from presence
                        state: participant.presence === "GHOST" ? "ghost" : "regular",
                        presence: participant.presence, // UI uses this to show ghost avatar
                        interruptedBy: "",
                        joinedAt: new Date(participant.lastSeen || Date.now()),
                        lastActivity: new Date(participant.lastSeen || Date.now()),
                    }));
                    console.log(`   ✅ Broadcasting ${roomUsers.length} users (V2) to room ${roomId}`);
                    console.log(`   Users: ${roomUsers.map((u) => `${u.name}${u.presence === "GHOST" ? "👻" : ""}`).join(", ")}\n`);
                    io.to(roomId).emit("user-list", roomUsers);
                }
                else {
                    // Fallback to V1 if no V2 state
                    console.log(`   ⚠️ No V2 state for room ${roomId}, using V1 fallback`);
                    const roomUsers = Array.from(users.entries())
                        .filter(([socketId, user]) => {
                        const userSocket = io.sockets.sockets.get(socketId);
                        const userRoomId = userSocket?.data?.roomId;
                        return userRoomId === roomId;
                    })
                        .map(([_, user]) => user);
                    console.log(`   ✅ Broadcasting ${roomUsers.length} users (V1) to room ${roomId}`);
                    io.to(roomId).emit("user-list", roomUsers);
                }
            }
            else {
                // Global broadcast (legacy)
                const list = Array.from(users.values());
                console.log(`[broadcastUserList] Global broadcast: ${list.length} users`);
                io.emit("user-list", list);
            }
        }
        function broadcastAvatarState(roomId) {
            if (roomId) {
                // Phase E: Room-scoped broadcast
                const roomAvatars = (0, avatarManager_1.getAvailableAvatars)(roomId);
                console.log(`🎨 [broadcastAvatarState] Broadcasting ${roomAvatars.length} avatars to room ${roomId}`);
                io.to(roomId).emit("avatars", roomAvatars);
            }
            else {
                // Legacy: Global broadcast
                const allAvatars = (0, avatarManager_1.getAvailableAvatars)("default-room");
                console.log(`🎨 [broadcastAvatarState] Global broadcast: ${allAvatars.length} avatars`);
                io.emit("avatars", allAvatars);
            }
        }
        function sendInitialPointerMap(socket, roomId) {
            const targetRoomId = roomId || socket.data?.roomId || "default-room";
            const currentPointers = getPointerMap(targetRoomId);
            const map = Array.from(currentPointers.entries()).map(([from, to]) => ({
                from,
                to,
            }));
            socket.emit("initial-pointer-map", map);
        }
        function sendCurrentLiveSpeaker(socket, roomId) {
            const targetRoomId = roomId || socket.data?.roomId || "default-room";
            const currentSpeaker = getLiveSpeaker(targetRoomId);
            if (currentSpeaker) {
                socket.emit("live-speaker", { name: currentSpeaker });
            }
        }
        // function logToConsole(msg: string) {
        //   io.emit("log-event", msg); // 🔥 everyone gets it
        //   // io.emit("log-")
        //   console.log(msg);
        // }
        // Phase E: Room-scoped logging functions
        function emitSystemLog(text, roomId) {
            if (roomId) {
                io.to(roomId).emit("system-log", text);
                console.log(`[SYSTEM][${roomId}]`, text);
            }
            else {
                io.emit("system-log", text); // Legacy global
                console.log("[SYSTEM]", text);
            }
        }
        function emitActionLog(text, roomId) {
            if (roomId) {
                io.to(roomId).emit("action-log", text);
                console.log(`[ACTION][${roomId}]`, text);
            }
            else {
                io.emit("action-log", text); // Legacy global
                console.log("[ACTION]", text);
            }
        }
        function emitTextLog(entry) {
            const payload = { ...entry, timestamp: Date.now() };
            io.emit("textlog:entry", payload);
            console.log("[TEXT]", payload);
        }
    });
}

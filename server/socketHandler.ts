// socketHandler.ts

import { Server, Socket } from "socket.io";
import {
  getAvailableAvatars,
  claimAvatar,
  releaseAvatarByName,
  emojiLookup,
} from "./avatarManager";
import { gestureCatalog } from "./ui-config/gestureCatalog";
import { getAllGestureButtons } from "./ui-config/gesture.service";
import { getAllTableDefinitions } from "./ui-config/tableDefinitions.service";
import { isValidTableId } from "./ui-config/tableDefinitions";
import { routeAction } from "./actions/routeAction"; // adjust path if needed
import { getPanelConfigFor } from "./panelConfigService"; // or wherever you store them
import { createGliffLog, clearGliffLog } from "./gliffLogService";
// Import session logic from BL layer
import {
  formatSessionLog as blFormatSessionLog,
  removeUser as removeUserFromBL,
  addUser as addUserToBL,
  addTableUser as addTableUserToBL,
} from "./BL/sessionLogic";

// ✨ ENGINE V2: Shadow Mode Integration
import {
  shadowDispatch,
  enableShadowMode,
} from "./engine-v2/shadow/shadowDispatcher";
import { dispatchAndRun } from "./engine-v2/reducer/dispatch";
import {
  mapLegacyToV2Action,
  extractUserId,
  extractRoomId,
} from "./engine-v2/shadow/actionMapper";

// ✨ ENGINE V2: Speaker Manager (Phase B)
import { speakerManager } from "./engine-v2/managers/SpeakerManager";
import { ENGINE_V2_SPEAKER_MANAGER } from "./config/featureFlags";

type GestureCatalogType = typeof gestureCatalog;
type ListenerType = keyof GestureCatalogType; // "ear" | "brain" | "mouth"
type SubGestureCode<T extends ListenerType> = keyof GestureCatalogType[T];
type UserState =
  | "regular"
  | "speaking"
  | "thinking"
  | "hasClickedMouth"
  | "hasClickedBrain";

type UserInfo = {
  name: string;
  avatarId: string;
  state: UserState;
  interruptedBy: string;
  joinedAt: Date;
  lastActivity: Date;
};

const users = new Map<string, UserInfo>(); // socketId -> { name, avatarId }
// Panel request tracking
const panelRequestCount = new Map<string, number>(); // userName -> count
const lastPanelRequest = new Map<string, number>(); // userName -> timestamp

// Socket.IO server instance (set in setupSocketHandlers)
let ioInstance: Server | null = null;

// Session timer state - Single source of truth
let sessionActive = false;
let sessionTimer: NodeJS.Timeout | null = null;
let sessionStartTime: Date | null = null;
let sessionDurationMinutes: number = 60; // Default to 60 minutes
let timerBroadcastInterval: NodeJS.Timeout | null = null;
let sessionId: string | null = null; // Unique session identifier

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

function formatSessionLog(
  message: string,
  type: "INFO" | "JOIN" | "LEAVE" | "ERROR" = "INFO",
) {
  const stats = getSimpleSessionStats();
  const timestamp = new Date().toISOString();

  return `[${timestamp}] [${type}] ${message} | Users: ${stats.userCount} (${
    stats.activeUsers || "none"
  })`;
}

function updateUserActivity(socketId: string) {
  const user = users.get(socketId);
  if (user) {
    user.lastActivity = new Date();
  }
}

// ============================================================================
// SPEAKER STATE (Engine V2 only)
// ============================================================================

let currentLogInput: string = ""; // optional state if needed later

/**
 * Get sync pause mode
 */
export function getIsSyncPauseMode(roomId: string = "default-room"): boolean {
  return speakerManager.getSyncPauseMode(roomId);
}

/**
 * Set sync pause mode - supports both legacy and V2
 * @param value - true to enable sync pause
 * @param roomId - Room ID (default: "default-room")
 */
export function setIsSyncPauseMode(
  value: boolean,
  roomId: string = "default-room",
): void {
  speakerManager.setSyncPauseMode(roomId, value);
}

/**
 * Get pointer map - supports both legacy and V2
 * @param roomId - Room ID (default: "default-room")
 */
export function getPointerMap(
  roomId: string = "default-room",
): Map<string, string> {
  return speakerManager.getPointerMap(roomId);
}

/**
 * Set a pointer - supports both legacy and V2
 * @param fromUser - User who is pointing
 * @param toUser - User being pointed to
 * @param roomId - Room ID (default: "default-room")
 */
export function setPointer(
  fromUser: string,
  toUser: string,
  roomId: string = "default-room",
): void {
  speakerManager.setPointer(roomId, fromUser, toUser);
}

/**
 * Clear a pointer - supports both legacy and V2
 * @param fromUser - User whose pointer to clear
 * @param roomId - Room ID (default: "default-room")
 */
export function clearPointer(
  fromUser: string,
  roomId: string = "default-room",
): void {
  speakerManager.clearPointer(roomId, fromUser);
}

/**
 * Clear all pointers - supports both legacy and V2
 * @param roomId - Room ID (default: "default-room")
 */
export function clearAllPointers(roomId: string = "default-room"): void {
  speakerManager.clearAllPointers(roomId);
}

/**
 * Get live speaker - supports both legacy and V2
 * @param roomId - Room ID (default: "default-room")
 */
export function getLiveSpeaker(roomId: string = "default-room"): string | null {
  return speakerManager.getLiveSpeaker(roomId);
}

/**
 * Set live speaker - supports both legacy and V2
 * @param name - User name (or null to clear)
 * @param roomId - Room ID (default: "default-room")
 */
export function setLiveSpeaker(
  name: string | null,
  roomId: string = "default-room",
): void {
  speakerManager.setLiveSpeaker(roomId, name);
}

// ============================================================================
// SESSION STATS
// ============================================================================

export function getSessionStats() {
  const currentTime = new Date();
  const userCount = users.size;
  const activeUsers = Array.from(users.values()).map((u) => ({
    name: u.name,
    avatarId: u.avatarId,
    state: u.state,
    joinedAt: u.joinedAt,
    lastActivity: u.lastActivity,
  }));

  return {
    userCount,
    activeUsers,
    sessionActive,
  };
}

// ============================================================================
// SESSION RESET
// ============================================================================

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

export function getUsers(roomId?: string) {
  if (!roomId) {
    // Legacy: return all users
    return users;
  }

  // Phase E: Filter users by room
  const roomUsers = new Map<string, UserInfo>();
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
export function getUserRoomId(userName: string): string | null {
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
export function globalBroadcastUserList(io: Server) {
  const list = Array.from(users.values());
  io.emit("user-list", list);
}

export function globalBroadcastAvatarState(io: Server) {
  io.emit("avatars", getAvailableAvatars());
}

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

export function setupSocketHandlers(io: Server) {
  // Store io instance for module-level functions (Phase E multi-table)
  ioInstance = io;
  
  // ✨ ENGINE V2: Enable Shadow Mode if environment variable is set
  if (process.env.ENGINE_V2_SHADOW === "true") {
    enableShadowMode();
    console.log(
      "[Server] ✨ Engine V2 shadow mode ENABLED - V2 running as passive observer",
    );
  }

  io.on("connection", (socket: Socket) => {
    console.log(
      formatSessionLog(`🪪 New socket connection: ${socket.id}`, "INFO"),
    );

    socket.on("joined-table", ({ name }) => {
      const avatar = users.get(socket.id)?.avatarId;
      const roomId = socket.data.roomId || socket.data.tableId;
      console.log(
        `[Server] 🔔 'joined-table' received from socket ${socket.id}, name: ${name}, room: ${roomId}`,
      );
      const emoji = emojiLookup[avatar || ""] || "";
      emitSystemLog(`🪑 ${emoji} ${name} has fully entered the table`, roomId);
      sendCurrentUserListTo(socket); // send only to this socket
    });

    function sendCurrentUserListTo(socket: Socket) {
      // Get the user's roomId and send room-filtered list
      const roomId = socket.data.roomId || socket.data.tableId;
      if (roomId) {
        const roomUsersMap = getUsers(roomId); // Returns Map<string, UserInfo>
        const roomUsers = Array.from(roomUsersMap.values());
        console.log(
          `🔍 [sendCurrentUserListTo] Sending ${roomUsers.length} users from room ${roomId} to socket ${socket.id}`,
        );
        socket.emit("user-list", roomUsers);
      } else {
        // Fallback to global list if no room assigned (shouldn't happen in multi-table mode)
        const list = Array.from(users.values());
        console.warn(
          `⚠️ [sendCurrentUserListTo] No roomId for socket ${socket.id}, sending global list (${list.length} users)`,
        );
        socket.emit("user-list", list);
      }
    }

    socket.on("request-join", ({ name, avatarId, tableId }) => {
      console.log(
        formatSessionLog(
          `📨 Join request: ${name} as ${avatarId} → table: ${tableId || "default-room"} (${socket.id})`,
          "INFO",
        ),
      );

      // ✅ Validate tableId if provided
      if (tableId && !isValidTableId(tableId)) {
        console.log(
          formatSessionLog(
            `🚫 Join rejected: Invalid tableId "${tableId}"`,
            "ERROR",
          ),
        );
        socket.emit("join-rejected", {
          reason: `Invalid table. Please choose a valid circle.`,
        });
        return;
      }

      // Store tableId in socket data for room resolution
      const resolvedTableId = tableId || "default-room";
      socket.data.roomId = resolvedTableId;
      socket.data.tableId = resolvedTableId;
      socket.data.userName = name; // Phase E: Store for disconnect logging
      socket.data.avatarId = avatarId; // Phase E: Store for disconnect logging
      console.log(
        formatSessionLog(
          `📌 Assigned socket to table: ${resolvedTableId}`,
          "INFO",
        ),
      );
      console.log(`🔍 [JOIN DEBUG] Socket ${socket.id} data:`, {
        roomId: socket.data.roomId,
        tableId: socket.data.tableId,
        name: name,
        avatar: avatarId,
      });

      // 🔥 CRITICAL: Join the Socket.IO room for this table
      socket.join(resolvedTableId);
      console.log(
        formatSessionLog(`🚪 Socket joined room: ${resolvedTableId}`, "INFO"),
      );

      // Verify the join
      const socketRooms = Array.from(socket.rooms);
      console.log(
        `🔍 [JOIN DEBUG] Socket ${socket.id} is now in rooms:`,
        socketRooms,
      );

      if (!name || name.length > 30) {
        console.log(
          formatSessionLog(`🚫 Join rejected: Invalid name "${name}"`, "ERROR"),
        );
        socket.emit("join-rejected", { reason: "Invalid name." });
        return;
      }

      // Phase E: Check for duplicate name WITHIN THIS ROOM
      const roomUsersMap = getUsers(resolvedTableId);
      console.log(
        `🔍 [NAME CHECK] Checking name "${name}" in room "${resolvedTableId}"`,
      );
      console.log(
        `🔍 [NAME CHECK] Found ${roomUsersMap.size} users in this room:`,
        Array.from(roomUsersMap.values()).map((u) => u.name),
      );
      const nameAlreadyTaken = Array.from(roomUsersMap.values()).some(
        (user) => user.name.toLowerCase() === name.toLowerCase(),
      );

      if (nameAlreadyTaken) {
        console.log(
          formatSessionLog(
            `🚫 Join rejected: Name "${name}" already taken in room ${resolvedTableId}`,
            "ERROR",
          ),
        );
        socket.emit("join-rejected", {
          reason: "Name already taken in this table. Please choose another.",
        });
        return;
      }

      // Phase E: Try to claim the avatar WITHIN THIS ROOM
      const claimed = claimAvatar(avatarId, name, resolvedTableId);
      if (!claimed) {
        console.log(
          formatSessionLog(
            `🚫 Join rejected: Avatar ${avatarId} already taken in room ${resolvedTableId}`,
            "ERROR",
          ),
        );
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
      addUserToBL(socket.id, {
        name,
        avatarId,
        state: "regular",
        interruptedBy: "",
        joinedAt: joinTime,
        lastActivity: joinTime,
      });
      addTableUserToBL(socket.id);

      const emoji = emojiLookup[avatarId] || "";
      console.log(
        formatSessionLog(
          `✅ ${emoji} ${name} joined table as ${avatarId}`,
          "JOIN",
        ),
      );
      emitSystemLog(`👤 ${emoji} ${name} joined table as ${avatarId}`, resolvedTableId);

      socket.emit("join-approved", { name, avatarId });

      // Give client time to set up event listeners, then check for session picker
      setTimeout(() => {
        // Critical: Show session picker to first user if no session is active
        const isFirstUser = users.size === 1;
        const noActiveSession = !sessionActive;

        console.log(`🔍 Session check for ${name} (after delay):`);
        console.log(
          `  - isFirstUser: ${isFirstUser} (users.size: ${users.size})`,
        );
        console.log(
          `  - noActiveSession: ${noActiveSession} (sessionActive: ${sessionActive})`,
        );
        console.log(`  - sessionId: ${sessionId || "none"}`);
        console.log(`  - socket.connected: ${socket.connected}`);

        if (isFirstUser && noActiveSession) {
          console.log(`🎯 TRIGGERING session picker for first user: ${name}`);

          // Send session picker to this specific user
          socket.emit("show-session-picker", {
            message: "As the first user, please choose the session length.",
            options: [60, 30, 15, 5], // Available durations in minutes
            allowCustom: true, // Allow free pick
            isFirstUser: true,
            timestamp: new Date().toISOString(),
          });

          console.log(
            `📤 Session picker sent to ${name} (socket: ${socket.id})`,
          );

          // Also emit to all sockets as a fallback
          io.emit("debug-session-picker-status", {
            target: name,
            triggered: true,
            reason: "First user joined, no active session",
          });
        } else {
          console.log(`🚫 Session picker NOT shown for ${name}:`);
          if (!isFirstUser)
            console.log(
              `  - Reason: Not first user (${users.size} users total)`,
            );
          if (!noActiveSession)
            console.log(
              `  - Reason: Session already active (ID: ${sessionId})`,
            );

          // Emit debug info
          io.emit("debug-session-picker-status", {
            target: name,
            triggered: false,
            reason: !isFirstUser
              ? `Not first user (${users.size} total)`
              : `Session already active (${sessionId})`,
          });
        }
      }, 500); // 500ms delay to ensure client is ready

      broadcastUserList(resolvedTableId); // Pass roomId
      broadcastAvatarState(resolvedTableId); // Phase E: Room-scoped avatar broadcast
      sendInitialPointerMap(socket, resolvedTableId); // Pass roomId
      sendCurrentLiveSpeaker(socket, resolvedTableId); // Pass roomId

      // ✨ ENGINE V2: Dispatch with effects
      try {
        const roomId = extractRoomId(socket, { name, avatarId });
        const userId = socket.id; // Use socketId consistently
        const action = mapLegacyToV2Action("request-join", {
          name,
          avatarId,
          socketId: socket.id,
        });
        dispatchAndRun(roomId, userId, action, io);

        // Debug: Print full room state after join
        const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
        roomRegistry.debugPrintAllRooms();
      } catch (error) {
        console.error("[V2] Failed on request-join:", error);
      }
    });

    // Handle session start request from first user
    socket.on("start-session", ({ durationMinutes }) => {
      const user = users.get(socket.id);
      if (!user) {
        socket.emit("session-start-rejected", {
          reason: "User not found",
        });
        return;
      }

      // Only allow first user to start session when no session is active
      if (users.size >= 1 && !sessionActive) {
        if (!durationMinutes || durationMinutes <= 0 || durationMinutes > 120) {
          socket.emit("session-start-rejected", {
            reason: "Invalid duration. Please choose between 1-120 minutes.",
          });
          return;
        }

        console.log(
          `🎯 ${user.name} started ${durationMinutes}-minute session`,
        );
        startSessionWithDuration(io, durationMinutes);

        // Notify all users that session has started
        io.emit("session-started", {
          durationMinutes,
          startedBy: user.name,
          message: `${user.name} started a ${durationMinutes}-minute session`,
        });

        // ✨ ENGINE V2: Dispatch with effects
        try {
          const roomId = extractRoomId(socket, { durationMinutes });
          const userId = socket.id; // Use socketId consistently
          const action = mapLegacyToV2Action("start-session", {
            durationMinutes,
          });
          dispatchAndRun(roomId, userId, action, io);
        } catch (error) {
          console.error("[V2] Failed on start-session:", error);
        }
      } else if (sessionActive) {
        socket.emit("session-start-rejected", {
          reason: "Session already active",
        });
      } else {
        socket.emit("session-start-rejected", {
          reason: "Not authorized to start session",
        });
      }
    });

    socket.on(
      "clientEmits",
      ({ name, type, subType, actionType, targetUser, flavor }) => {
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

        const roomId =
          socket.data.roomId || socket.data.tableId || "default-room";
        routeAction(
          { name, type, subType, actionType, targetUser, flavor },
          {
            io,
            logSystem: (text: string) => emitSystemLog(text, roomId),
            logAction: (text: string) => emitActionLog(text, roomId),
            pointerMap: getPointerMap(),
            gestureCatalog,
            socketId: socket.id,
            roomId,
            users,
          },
        );
      },
    );

    socket.on("leave", ({ name }) => {
      const user = users.get(socket.id);
      const roomId = socket.data.roomId || socket.data.tableId;
      if (user) {
        const sessionDuration = Math.floor(
          (new Date().getTime() - user.joinedAt.getTime()) / 1000,
        );
        console.log(
          formatSessionLog(
            `👋 ${name} left manually (was in session ${Math.floor(
              sessionDuration / 60,
            )}m${sessionDuration % 60}s)`,
            "LEAVE",
          ),
        );
        emitSystemLog(`👋 ${name} left manually`, roomId);
      } else {
        console.log(
          formatSessionLog(
            `👋 ${name} left manually (no session data)`,
            "LEAVE",
          ),
        );
        emitSystemLog(`👋 ${name} left manually`, roomId);
      }
      cleanupUser(socket);
    });

    socket.on("disconnect", () => {
      // Phase E: Get user info from Map first, fallback to socket.data
      const user = users.get(socket.id);
      const roomId = socket.data.roomId || socket.data.tableId;
      const userName = user?.name || socket.data.userName || "Unknown";
      const avatarId = user?.avatarId || socket.data.avatarId;

      if (user) {
        const sessionDuration = Math.floor(
          (new Date().getTime() - user.joinedAt.getTime()) / 1000,
        );
        console.log(
          formatSessionLog(
            `❌ ${
              user.name
            } disconnected unexpectedly (was in session ${Math.floor(
              sessionDuration / 60,
            )}m${sessionDuration % 60}s)`,
            "LEAVE",
          ),
        );
      } else if (socket.data.userName) {
        // User was already cleaned up, but we have socket.data backup
        console.log(
          formatSessionLog(
            `❌ ${socket.data.userName} disconnected (already cleaned up)`,
            "LEAVE",
          ),
        );
      } else {
        console.log(
          formatSessionLog(
            `❌ Unknown socket ${socket.id} disconnected (no user data)`,
            "ERROR",
          ),
        );
      }

      // Always emit system log with best available name
      const emoji = avatarId ? emojiLookup[avatarId] || "" : "";
      emitSystemLog(`❌ ${emoji} ${userName} disconnected`, roomId);

      cleanupUser(socket);

      // ✨ ENGINE V2: Dispatch with effects
      try {
        const roomId = extractRoomId(socket, {});
        const userId = socket.id; // Use socketId consistently
        const action = mapLegacyToV2Action("disconnect", {});
        dispatchAndRun(roomId, userId, action, io);
      } catch (error) {
        console.error("[V2] Failed on disconnect:", error);
      }
    });

    socket.on("pointing", ({ from, to }) => {
      updateUserActivity(socket.id);
      console.log("[Client] Emitting pointing to:", from, to);
      const roomIdPointing =
        socket.data.roomId || socket.data.tableId || "default-room";
      routeAction(
        {
          from,
          type: "pointing",
          subType: "manual",
          actionType: "pointAtSpeaker",
          to,
        },
        {
          io,
          logSystem: (text: string) => emitSystemLog(text, roomIdPointing),
          logAction: (text: string) => emitActionLog(text, roomIdPointing),
          pointerMap: getPointerMap(),
          gestureCatalog,
          socketId: socket.id,
          roomId: roomIdPointing,
          users,
        },
      );

      // ✨ ENGINE V2: Dispatch with effects
      try {
        const roomId = extractRoomId(socket, { from, to });
        const userId = socket.id; // Use socketId consistently
        const action = mapLegacyToV2Action("pointing", { from, to });
        dispatchAndRun(roomId, userId, action, io);
      } catch (error) {
        console.error("[V2] Failed on pointing:", error);
      }
    });

    socket.on(
      "logBar:update",
      ({ text, userName }: { text: string; userName: string }) => {
        const user = users.get(socket.id);

        if (!user) {
          console.log(
            `🚫 Rejected logBar:update — unknown user (${socket.id})`,
          );
          return;
        }

        updateUserActivity(socket.id);

        // Phase E: Use actual room ID
        const roomId =
          socket.data.roomId || socket.data.tableId || "default-room";
        const currentSpeaker = getLiveSpeaker(roomId);
        if (user.name !== currentSpeaker) {
          console.log(
            `🚫 Rejected logBar:update — ${user.name} is not live in room ${roomId} (liveSpeaker=${currentSpeaker})`,
          );
          return;
        }

        console.log(
          `📡 [Room ${roomId}] logBar:update from ${user.name}:`,
          text,
        );

        createGliffLog(
          {
            userName,
            message: {
              messageType: "textInput",
              content: text,
              timestamp: Date.now(),
            },
          },
          io,
          roomId, // Pass roomId for room-scoped gliff
        );
      },
    );

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
      const buttons = getAllGestureButtons();
      socket.emit("receive:gestureButtons", buttons);
    });

    socket.on("request:tableDefinitions", () => {
      // Reduced logging - only log once per socket
      if (!socket.data.hasRequestedTableDefs) {
        console.log(
          `[Server] First table definitions request from socket ${socket.id}`,
        );
        socket.data.hasRequestedTableDefs = true;
      }
      const tables = getAllTableDefinitions();
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

      console.log(
        formatSessionLog(
          `🛠️ [PANEL-DEBUG] Building panel config for ${userName} (socket: ${socket.id}) | Request #${currentCount} | ${timeSinceLastRequest}ms since last`,
          "INFO",
        ),
      );

      const config = getPanelConfigFor(userName);
      console.log(
        formatSessionLog(
          `🛠️ [PANEL-DEBUG] Sending panel config to ${userName} (socket: ${socket.id})`,
          "INFO",
        ),
      );
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

        console.log(
          `[Server] 📊 Returning ${sessions.length} active session(s)`,
        );

        socket.emit("sessions-list", {
          sessions,
          timestamp: Date.now(),
        });
      } catch (error) {
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
        } else {
          socket.emit("session-status", {
            inSession: false,
          });
        }
      } catch (error) {
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

      console.log(
        `[Server] 🛑 admin-end-session: Session ${sessionId} by admin ${adminId || "unknown"}`,
      );

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

        console.log(
          `[Server] ✅ admin-end-session dispatched for session ${sessionId}`,
        );

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
      } catch (error) {
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
    socket.on("get-avatars", (payload?: { tableId?: string }) => {
      // Priority: payload.tableId → socket.data → default
      const roomId =
        payload?.tableId ||
        socket.data?.roomId ||
        socket.data?.tableId ||
        "default-room";
      const roomAvatars = getAvailableAvatars(roomId);
      console.log(
        `🎨 [get-avatars] Sending ${roomAvatars.length} avatars for room ${roomId} to socket ${socket.id}`,
      );
      socket.emit("avatars", roomAvatars);
    });

    function cleanupUser(socket: Socket) {
      const user = users.get(socket.id);
      if (!user) return;

      // Get room ID before cleanup
      const userRoomId =
        socket.data?.roomId || socket.data?.tableId || "default-room";

      users.delete(socket.id);
      // Also remove from session logic tracking
      removeUserFromBL(socket.id);

      clearPointer(user.name, userRoomId); // Pass roomId
      releaseAvatarByName(user.name, userRoomId); // Phase E: Release avatar from specific room
      setIsSyncPauseMode(false, userRoomId); // Pass roomId

      // Clear any pointers TO this user in their room
      const currentPointers = getPointerMap(userRoomId);
      for (const [from, to] of currentPointers.entries()) {
        if (to === user.name) clearPointer(from, userRoomId);
      }

      // Count users in this specific room
      const roomUserCount = Array.from(users.entries()).filter(
        ([socketId, _]) => {
          const userSocket = io.sockets.sockets.get(socketId);
          return userSocket?.data?.roomId === userRoomId;
        },
      ).length;

      // Reset session timer if all users have left THIS ROOM
      if (roomUserCount === 0 && sessionActive) {
        console.log(
          `🔄 All users left room ${userRoomId} - resetting session timer`,
        );
        endSession(io);
      }

      broadcastUserList(userRoomId); // Pass roomId
      broadcastAvatarState(userRoomId); // Phase E: Room-scoped avatar broadcast
    }

    function broadcastUserList(roomId?: string) {
      if (roomId) {
        // Room-specific broadcast (Phase E multi-table)
        console.log(`\n🔍 [broadcastUserList] Filtering for room: ${roomId}`);
        console.log(`   Total users in system: ${users.size}`);

        const roomUsers = Array.from(users.entries())
          .filter(([socketId, user]) => {
            const userSocket = io.sockets.sockets.get(socketId);
            const userRoomId = userSocket?.data?.roomId;
            const matches = userRoomId === roomId;
            console.log(
              `   - ${user.name} (${socketId}): roomId=${userRoomId}, matches=${matches}`,
            );
            return matches;
          })
          .map(([_, user]) => user);

        console.log(
          `   ✅ Broadcasting ${roomUsers.length} users to room ${roomId}`,
        );
        console.log(`   Users: ${roomUsers.map((u) => u.name).join(", ")}\n`);
        io.to(roomId).emit("user-list", roomUsers);
      } else {
        // Global broadcast (legacy)
        const list = Array.from(users.values());
        console.log(
          `[broadcastUserList] Global broadcast: ${list.length} users`,
        );
        io.emit("user-list", list);
      }
    }

    function broadcastAvatarState(roomId?: string) {
      if (roomId) {
        // Phase E: Room-scoped broadcast
        const roomAvatars = getAvailableAvatars(roomId);
        console.log(
          `🎨 [broadcastAvatarState] Broadcasting ${roomAvatars.length} avatars to room ${roomId}`,
        );
        io.to(roomId).emit("avatars", roomAvatars);
      } else {
        // Legacy: Global broadcast
        const allAvatars = getAvailableAvatars("default-room");
        console.log(
          `🎨 [broadcastAvatarState] Global broadcast: ${allAvatars.length} avatars`,
        );
        io.emit("avatars", allAvatars);
      }
    }

    function sendInitialPointerMap(socket: Socket, roomId?: string) {
      const targetRoomId = roomId || socket.data?.roomId || "default-room";
      const currentPointers = getPointerMap(targetRoomId);
      const map = Array.from(currentPointers.entries()).map(([from, to]) => ({
        from,
        to,
      }));
      socket.emit("initial-pointer-map", map);
    }

    function sendCurrentLiveSpeaker(socket: Socket, roomId?: string) {
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
    function emitSystemLog(text: string, roomId?: string) {
      if (roomId) {
        io.to(roomId).emit("system-log", text);
        console.log(`[SYSTEM][${roomId}]`, text);
      } else {
        io.emit("system-log", text); // Legacy global
        console.log("[SYSTEM]", text);
      }
    }

    function emitActionLog(text: string, roomId?: string) {
      if (roomId) {
        io.to(roomId).emit("action-log", text);
        console.log(`[ACTION][${roomId}]`, text);
      } else {
        io.emit("action-log", text); // Legacy global
        console.log("[ACTION]", text);
      }
    }

    function emitTextLog(entry: { userName: string; text: string }) {
      const payload = { ...entry, timestamp: Date.now() };
      io.emit("textlog:entry", payload);
      console.log("[TEXT]", payload);
    }
  });
}

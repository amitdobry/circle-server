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
exports.globalBroadcastUserList = globalBroadcastUserList;
exports.globalBroadcastAvatarState = globalBroadcastAvatarState;
exports.setupSocketHandlers = setupSocketHandlers;
const avatarManager_1 = require("./avatarManager");
const gestureCatalog_1 = require("./ui-config/gestureCatalog");
const gesture_service_1 = require("./ui-config/gesture.service");
const routeAction_1 = require("./actions/routeAction"); // adjust path if needed
const panelConfigService_1 = require("./panelConfigService"); // or wherever you store them
const gliffLogService_1 = require("./gliffLogService");
// Import session logic from BL layer
const sessionLogic_1 = require("./BL/sessionLogic");
// ✨ ENGINE V2: Shadow Mode Integration
const shadowDispatcher_1 = require("./engine-v2/shadow/shadowDispatcher");
const actionMapper_1 = require("./engine-v2/shadow/actionMapper");
// ✨ ENGINE V2: Speaker Manager (Phase B)
const SpeakerManager_1 = require("./engine-v2/managers/SpeakerManager");
const featureFlags_1 = require("./config/featureFlags");
const users = new Map(); // socketId -> { name, avatarId }
// Panel request tracking
const panelRequestCount = new Map(); // userName -> count
const lastPanelRequest = new Map(); // userName -> timestamp
// Session timer state - Single source of truth
let sessionActive = false;
let sessionTimer = null;
let sessionStartTime = null;
let sessionDurationMinutes = 60; // Default to 60 minutes
let timerBroadcastInterval = null;
let sessionId = null; // Unique session identifier
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
// SPEAKER STATE (Dual-Mode: Legacy + Engine V2)
// ============================================================================
// Legacy globals (will be deprecated when ENGINE_V2_SPEAKER_MANAGER is enabled)
const pointerMap = new Map(); // from -> to
let liveSpeaker = null;
let isSyncPauseMode = false;
let currentLogInput = ""; // optional state if needed later
/**
 * Get sync pause mode - supports both legacy and V2
 * @param roomId - Room ID (default: "default-room")
 */
function getIsSyncPauseMode(roomId = "default-room") {
    if (featureFlags_1.ENGINE_V2_SPEAKER_MANAGER) {
        return SpeakerManager_1.speakerManager.getSyncPauseMode(roomId);
    }
    return isSyncPauseMode; // Legacy
}
/**
 * Set sync pause mode - supports both legacy and V2
 * @param value - true to enable sync pause
 * @param roomId - Room ID (default: "default-room")
 */
function setIsSyncPauseMode(value, roomId = "default-room") {
    if (featureFlags_1.ENGINE_V2_SPEAKER_MANAGER) {
        SpeakerManager_1.speakerManager.setSyncPauseMode(roomId, value);
    }
    else {
        isSyncPauseMode = value; // Legacy
    }
}
/**
 * Get pointer map - supports both legacy and V2
 * @param roomId - Room ID (default: "default-room")
 */
function getPointerMap(roomId = "default-room") {
    if (featureFlags_1.ENGINE_V2_SPEAKER_MANAGER) {
        return SpeakerManager_1.speakerManager.getPointerMap(roomId);
    }
    return pointerMap; // Legacy
}
/**
 * Set a pointer - supports both legacy and V2
 * @param fromUser - User who is pointing
 * @param toUser - User being pointed to
 * @param roomId - Room ID (default: "default-room")
 */
function setPointer(fromUser, toUser, roomId = "default-room") {
    if (featureFlags_1.ENGINE_V2_SPEAKER_MANAGER) {
        SpeakerManager_1.speakerManager.setPointer(roomId, fromUser, toUser);
    }
    else {
        pointerMap.set(fromUser, toUser); // Legacy
    }
}
/**
 * Clear a pointer - supports both legacy and V2
 * @param fromUser - User whose pointer to clear
 * @param roomId - Room ID (default: "default-room")
 */
function clearPointer(fromUser, roomId = "default-room") {
    if (featureFlags_1.ENGINE_V2_SPEAKER_MANAGER) {
        SpeakerManager_1.speakerManager.clearPointer(roomId, fromUser);
    }
    else {
        pointerMap.delete(fromUser); // Legacy
    }
}
/**
 * Clear all pointers - supports both legacy and V2
 * @param roomId - Room ID (default: "default-room")
 */
function clearAllPointers(roomId = "default-room") {
    if (featureFlags_1.ENGINE_V2_SPEAKER_MANAGER) {
        SpeakerManager_1.speakerManager.clearAllPointers(roomId);
    }
    else {
        pointerMap.clear(); // Legacy
    }
}
/**
 * Get live speaker - supports both legacy and V2
 * @param roomId - Room ID (default: "default-room")
 */
function getLiveSpeaker(roomId = "default-room") {
    if (featureFlags_1.ENGINE_V2_SPEAKER_MANAGER) {
        return SpeakerManager_1.speakerManager.getLiveSpeaker(roomId);
    }
    return liveSpeaker; // Legacy
}
/**
 * Set live speaker - supports both legacy and V2
 * @param name - User name (or null to clear)
 * @param roomId - Room ID (default: "default-room")
 */
function setLiveSpeaker(name, roomId = "default-room") {
    if (featureFlags_1.ENGINE_V2_SPEAKER_MANAGER) {
        SpeakerManager_1.speakerManager.setLiveSpeaker(roomId, name);
    }
    else {
        liveSpeaker = name; // Legacy
    }
}
// ============================================================================
// SESSION STATS
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
function resetSessionState() {
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
    // Clean up all users and release their avatars during reset
    console.log("🔄 Session state manually reset - cleaning up users");
    for (const [socketId, user] of users.entries()) {
        console.log(`🔓 Releasing avatar ${user.avatarId} for user ${user.name}`);
        (0, avatarManager_1.releaseAvatarByName)(user.name);
        (0, sessionLogic_1.removeUser)(socketId);
    }
    // Clear all user data
    users.clear();
    // Clear speaker state (dual-mode compatible)
    const roomId = "default-room";
    if (featureFlags_1.ENGINE_V2_SPEAKER_MANAGER) {
        SpeakerManager_1.speakerManager.clearAllPointers(roomId);
        SpeakerManager_1.speakerManager.setLiveSpeaker(roomId, null);
        SpeakerManager_1.speakerManager.setSyncPauseMode(roomId, false);
    }
    else {
        pointerMap.clear();
        liveSpeaker = null;
        isSyncPauseMode = false;
    }
    console.log("🔄 Session state manually reset");
}
// Session state checker
function getSessionState() {
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
function getUsers() {
    return users;
}
// Global broadcast functions for session management
function globalBroadcastUserList(io) {
    const list = Array.from(users.values());
    io.emit("user-list", list);
}
function globalBroadcastAvatarState(io) {
    io.emit("avatars", (0, avatarManager_1.getAvailableAvatars)());
}
// Session start function with configurable duration
function startSessionWithDuration(io, durationMinutes = 60) {
    if (sessionActive) {
        console.log(`⚠️ Attempted to start session but one is already active (ID: ${sessionId})`);
        return;
    }
    sessionActive = true;
    sessionStartTime = new Date();
    sessionDurationMinutes = durationMinutes;
    sessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
    console.log(`🚀 Session started (ID: ${sessionId}) - ${durationMinutes} minute timer begins`);
    // Set timer for specified duration
    sessionTimer = setTimeout(() => {
        endSession(io);
    }, durationMinutes * 60 * 1000); // Convert minutes to milliseconds
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
function startSession(io) {
    startSessionWithDuration(io, 60);
}
function endSession(io) {
    sessionActive = false;
    sessionStartTime = null;
    sessionDurationMinutes = 60; // Reset to default
    console.log("⏰ Session ended - navigating users to home page");
    // Stop timer broadcasts
    if (timerBroadcastInterval) {
        clearInterval(timerBroadcastInterval);
        timerBroadcastInterval = null;
    }
    // Clear the gliff log when session ends
    (0, gliffLogService_1.clearGliffLog)(io);
    // Clean up all users and release their avatars
    console.log("🧹 Cleaning up all users and releasing avatars");
    for (const [socketId, user] of users.entries()) {
        console.log(`🔓 Releasing avatar ${user.avatarId} for user ${user.name}`);
        (0, avatarManager_1.releaseAvatarByName)(user.name);
        (0, sessionLogic_1.removeUser)(socketId);
    }
    // Clear all user data
    users.clear();
    clearAllPointers("default-room");
    setLiveSpeaker(null, "default-room");
    setIsSyncPauseMode(false, "default-room");
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
function startTimerBroadcast(io) {
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
        const elapsedSeconds = Math.floor((currentTime.getTime() - sessionStartTime.getTime()) / 1000);
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
function setupSocketHandlers(io) {
    // ✨ ENGINE V2: Enable Shadow Mode if environment variable is set
    if (process.env.ENGINE_V2_SHADOW === "true") {
        (0, shadowDispatcher_1.enableShadowMode)();
        console.log("[Server] ✨ Engine V2 shadow mode ENABLED - V2 running as passive observer");
    }
    io.on("connection", (socket) => {
        console.log(formatSessionLog(`🪪 New socket connection: ${socket.id}`, "INFO"));
        socket.on("joined-table", ({ name }) => {
            const avatar = users.get(socket.id)?.avatarId;
            console.log(`[Server] 🔔 'joined-table' received from socket ${socket.id}, name: ${name}`);
            const emoji = avatarManager_1.emojiLookup[avatar || ""] || "";
            emitSystemLog(`🪑 ${emoji} ${name} has fully entered the table`);
            sendCurrentUserListTo(socket); // send only to this socket
        });
        function sendCurrentUserListTo(socket) {
            const list = Array.from(users.values());
            socket.emit("user-list", list);
        }
        socket.on("request-join", ({ name, avatarId }) => {
            console.log(formatSessionLog(`📨 Join request: ${name} as ${avatarId} (${socket.id})`, "INFO"));
            if (!name || name.length > 30) {
                console.log(formatSessionLog(`🚫 Join rejected: Invalid name "${name}"`, "ERROR"));
                socket.emit("join-rejected", { reason: "Invalid name." });
                return;
            }
            // 🔥 Check for duplicate name
            const nameAlreadyTaken = Array.from(users.values()).some((user) => user.name.toLowerCase() === name.toLowerCase());
            if (nameAlreadyTaken) {
                console.log(formatSessionLog(`🚫 Join rejected: Name "${name}" already taken`, "ERROR"));
                socket.emit("join-rejected", {
                    reason: "Name already taken. Please choose another.",
                });
                return;
            }
            // 🔥 Try to claim the avatar
            const claimed = (0, avatarManager_1.claimAvatar)(avatarId, name);
            if (!claimed) {
                console.log(formatSessionLog(`🚫 Join rejected: Avatar ${avatarId} already taken`, "ERROR"));
                socket.emit("join-rejected", {
                    reason: "Avatar already taken. Please choose another.",
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
            emitSystemLog(`👤 ${emoji} ${name} joined table as ${avatarId}`);
            socket.emit("join-approved", { name, avatarId });
            // Give client time to set up event listeners, then check for session picker
            setTimeout(() => {
                // Critical: Show session picker to first user if no session is active
                const isFirstUser = users.size === 1;
                const noActiveSession = !sessionActive;
                console.log(`🔍 Session check for ${name} (after delay):`);
                console.log(`  - isFirstUser: ${isFirstUser} (users.size: ${users.size})`);
                console.log(`  - noActiveSession: ${noActiveSession} (sessionActive: ${sessionActive})`);
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
                    console.log(`📤 Session picker sent to ${name} (socket: ${socket.id})`);
                    // Also emit to all sockets as a fallback
                    io.emit("debug-session-picker-status", {
                        target: name,
                        triggered: true,
                        reason: "First user joined, no active session",
                    });
                }
                else {
                    console.log(`🚫 Session picker NOT shown for ${name}:`);
                    if (!isFirstUser)
                        console.log(`  - Reason: Not first user (${users.size} users total)`);
                    if (!noActiveSession)
                        console.log(`  - Reason: Session already active (ID: ${sessionId})`);
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
            broadcastUserList();
            broadcastAvatarState();
            sendInitialPointerMap(socket);
            sendCurrentLiveSpeaker(socket);
            // ✨ ENGINE V2: Shadow dispatch
            try {
                const roomId = (0, actionMapper_1.extractRoomId)(socket, { name, avatarId });
                const userId = socket.id; // Use socketId consistently
                const action = (0, actionMapper_1.mapLegacyToV2Action)("request-join", {
                    name,
                    avatarId,
                    socketId: socket.id,
                });
                (0, shadowDispatcher_1.shadowDispatch)(roomId, userId, action);
            }
            catch (error) {
                // Swallow errors, don't break V1
                console.error("[V2 Shadow] Failed on request-join:", error);
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
                console.log(`🎯 ${user.name} started ${durationMinutes}-minute session`);
                startSessionWithDuration(io, durationMinutes);
                // Notify all users that session has started
                io.emit("session-started", {
                    durationMinutes,
                    startedBy: user.name,
                    message: `${user.name} started a ${durationMinutes}-minute session`,
                });
                // ✨ ENGINE V2: Shadow dispatch
                try {
                    const roomId = (0, actionMapper_1.extractRoomId)(socket, { durationMinutes });
                    const userId = socket.id; // Use socketId consistently
                    const action = (0, actionMapper_1.mapLegacyToV2Action)("start-session", {
                        durationMinutes,
                    });
                    (0, shadowDispatcher_1.shadowDispatch)(roomId, userId, action);
                }
                catch (error) {
                    // Swallow errors, don't break V1
                    console.error("[V2 Shadow] Failed on start-session:", error);
                }
            }
            else if (sessionActive) {
                socket.emit("session-start-rejected", {
                    reason: "Session already active",
                });
            }
            else {
                socket.emit("session-start-rejected", {
                    reason: "Not authorized to start session",
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
            (0, routeAction_1.routeAction)({ name, type, subType, actionType, targetUser, flavor }, {
                io,
                logSystem: emitSystemLog,
                logAction: emitActionLog,
                pointerMap,
                evaluateSync,
                gestureCatalog: gestureCatalog_1.gestureCatalog,
                socketId: socket.id,
                users,
            });
        });
        socket.on("leave", ({ name }) => {
            const user = users.get(socket.id);
            if (user) {
                const sessionDuration = Math.floor((new Date().getTime() - user.joinedAt.getTime()) / 1000);
                console.log(formatSessionLog(`👋 ${name} left manually (was in session ${Math.floor(sessionDuration / 60)}m${sessionDuration % 60}s)`, "LEAVE"));
                emitSystemLog(`👋 ${name} left manually`);
            }
            else {
                console.log(formatSessionLog(`👋 ${name} left manually (no session data)`, "LEAVE"));
                emitSystemLog(`👋 ${name} left manually`);
            }
            cleanupUser(socket);
        });
        socket.on("disconnect", () => {
            const user = users.get(socket.id);
            if (user) {
                const sessionDuration = Math.floor((new Date().getTime() - user.joinedAt.getTime()) / 1000);
                console.log(formatSessionLog(`❌ ${user.name} disconnected unexpectedly (was in session ${Math.floor(sessionDuration / 60)}m${sessionDuration % 60}s)`, "LEAVE"));
                emitSystemLog(`❌ ${user.name} disconnected`);
            }
            else {
                console.log(formatSessionLog(`❌ Unknown socket ${socket.id} disconnected (no user data)`, "ERROR"));
                emitSystemLog(`❌ Unknown disconnected`);
            }
            cleanupUser(socket);
            // ✨ ENGINE V2: Shadow dispatch
            try {
                const roomId = (0, actionMapper_1.extractRoomId)(socket, {});
                const userId = socket.id; // Use socketId consistently
                const action = (0, actionMapper_1.mapLegacyToV2Action)("disconnect", {});
                (0, shadowDispatcher_1.shadowDispatch)(roomId, userId, action);
            }
            catch (error) {
                // Swallow errors, don't break V1
                console.error("[V2 Shadow] Failed on disconnect:", error);
            }
        });
        socket.on("pointing", ({ from, to }) => {
            updateUserActivity(socket.id);
            console.log("[Client] Emitting pointing to:", from, to);
            (0, routeAction_1.routeAction)({
                from,
                type: "pointing",
                subType: "manual",
                actionType: "pointAtSpeaker",
                to,
            }, {
                io,
                logSystem: emitSystemLog,
                logAction: emitActionLog,
                pointerMap,
                evaluateSync,
                gestureCatalog: gestureCatalog_1.gestureCatalog,
                socketId: socket.id,
                users,
            });
            // ✨ ENGINE V2: Shadow dispatch
            try {
                const roomId = (0, actionMapper_1.extractRoomId)(socket, { from, to });
                const userId = socket.id; // Use socketId consistently
                const action = (0, actionMapper_1.mapLegacyToV2Action)("pointing", { from, to });
                (0, shadowDispatcher_1.shadowDispatch)(roomId, userId, action);
            }
            catch (error) {
                // Swallow errors, don't break V1
                console.error("[V2 Shadow] Failed on pointing:", error);
            }
        });
        socket.on("logBar:update", ({ text, userName }) => {
            const user = users.get(socket.id);
            if (!user) {
                console.log(`🚫 Rejected logBar:update — unknown user (${socket.id})`);
                return;
            }
            updateUserActivity(socket.id);
            const roomId = "default-room";
            const currentSpeaker = getLiveSpeaker(roomId);
            if (user.name !== currentSpeaker) {
                console.log(`🚫 Rejected logBar:update — ${user.name} is not live (liveSpeaker=${currentSpeaker})`);
                return;
            }
            console.log(`📡 logBar:update from ${user.name}:`, text);
            (0, gliffLogService_1.createGliffLog)({
                userName,
                message: {
                    messageType: "textInput",
                    content: text,
                    timestamp: Date.now(),
                },
            }, io);
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
        // Request: list of avatars
        socket.on("get-avatars", () => {
            socket.emit("avatars", (0, avatarManager_1.getAvailableAvatars)());
        });
        function cleanupUser(socket) {
            const user = users.get(socket.id);
            if (!user)
                return;
            users.delete(socket.id);
            // Also remove from session logic tracking
            (0, sessionLogic_1.removeUser)(socket.id);
            clearPointer("default-room", user.name);
            (0, avatarManager_1.releaseAvatarByName)(user.name);
            setIsSyncPauseMode(false, "default-room");
            // Clear any pointers TO this user
            const currentPointers = getPointerMap("default-room");
            for (const [from, to] of currentPointers.entries()) {
                if (to === user.name)
                    clearPointer("default-room", from);
            }
            // Reset session timer if all users have left
            if (users.size === 0 && sessionActive) {
                console.log("🔄 All users left - resetting session timer");
                endSession(io);
            }
            broadcastUserList();
            broadcastAvatarState();
            evaluateSync();
        }
        function broadcastUserList() {
            const list = Array.from(users.values()); // now includes avatarId
            io.emit("user-list", list);
        }
        function broadcastAvatarState() {
            io.emit("avatars", (0, avatarManager_1.getAvailableAvatars)());
        }
        function sendInitialPointerMap(socket) {
            const roomId = "default-room";
            const currentPointers = getPointerMap(roomId);
            const map = Array.from(currentPointers.entries()).map(([from, to]) => ({
                from,
                to,
            }));
            socket.emit("initial-pointer-map", map);
        }
        function sendCurrentLiveSpeaker(socket) {
            const roomId = "default-room";
            const currentSpeaker = getLiveSpeaker(roomId);
            if (currentSpeaker) {
                socket.emit("live-speaker", { name: currentSpeaker });
            }
        }
        // function logToConsole(msg: string) {
        //   io.emit("log-event", msg); // 🔥 everyone gets it
        //   // io.emit("log-")
        //   console.log(msg);
        // }
        function emitSystemLog(text) {
            io.emit("system-log", text);
            console.log("[SYSTEM]", text);
        }
        function emitActionLog(text) {
            io.emit("action-log", text); // ✅ renamed
            console.log("[ACTION]", text);
        }
        function emitTextLog(entry) {
            const payload = { ...entry, timestamp: Date.now() };
            io.emit("textlog:entry", payload);
            console.log("[TEXT]", payload);
        }
        function evaluateSync() {
            const roomId = "default-room";
            const candidates = Array.from(users.values());
            const currentPointers = getPointerMap(roomId);
            const currentSpeaker = getLiveSpeaker(roomId);
            let newLiveSpeaker = null;
            for (const candidate of candidates) {
                const everyoneElse = candidates.filter((u) => u.name !== candidate.name);
                const allPointing = everyoneElse.every((u) => currentPointers.get(u.name) === candidate.name);
                const selfPointing = currentPointers.get(candidate.name) === candidate.name;
                if (allPointing && selfPointing) {
                    newLiveSpeaker = candidate.name;
                    break;
                }
            }
            for (const [socketId, user] of users.entries()) {
                if (user.name === newLiveSpeaker) {
                    user.state = "speaking";
                    users.set(socketId, user);
                }
            }
            if (newLiveSpeaker !== currentSpeaker) {
                setLiveSpeaker(newLiveSpeaker, roomId);
                if (newLiveSpeaker) {
                    emitActionLog(`🎤 All attention on ${newLiveSpeaker}. Going LIVE.`);
                    // 💡 Reset concent-mode users to regular listeners
                    for (const [socketId, user] of users.entries()) {
                        if (user.name !== newLiveSpeaker) {
                            user.state = "regular";
                            users.set(socketId, user);
                        }
                    }
                    setIsSyncPauseMode(false, roomId);
                    io.emit("live-speaker", { name: newLiveSpeaker });
                    io.emit("logBar:update", {
                        text: `${newLiveSpeaker}: `,
                        userName: newLiveSpeaker,
                    });
                    for (const [socketId, user] of users.entries()) {
                        console.log(formatSessionLog(`🛠️ [PANEL-DEBUG-SYNC] Building panel config for ${user.name} (socket: ${socketId}) during speaker sync`, "INFO"));
                        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
                        console.log(formatSessionLog(`🛠️ [PANEL-DEBUG-SYNC] Sending panel config to ${user.name} (socket: ${socketId}) during speaker sync`, "INFO"));
                        io.to(socketId).emit("receive:panelConfig", config);
                    }
                }
                else {
                    emitActionLog("🔇 No speaker in sync. Clearing Live tag.");
                    io.emit("live-speaker-cleared");
                }
            }
        }
    });
}

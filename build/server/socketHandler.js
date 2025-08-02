"use strict";
// socketHandler.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIsSyncPauseMode = getIsSyncPauseMode;
exports.setIsSyncPauseMode = setIsSyncPauseMode;
exports.getPointerMap = getPointerMap;
exports.getSessionStats = getSessionStats;
exports.getLiveSpeaker = getLiveSpeaker;
exports.setLiveSpeaker = setLiveSpeaker;
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
const pointerMap = new Map(); // from -> to
let liveSpeaker = null;
let currentLogInput = ""; // optional state if needed later
let isSyncPauseMode = false;
function getIsSyncPauseMode() {
    return isSyncPauseMode;
}
function setIsSyncPauseMode(value) {
    isSyncPauseMode = value;
}
function getPointerMap() {
    return pointerMap;
}
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
function getLiveSpeaker() {
    return liveSpeaker;
}
function setLiveSpeaker(name) {
    liveSpeaker = name;
}
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
    pointerMap.clear();
    liveSpeaker = null;
    setIsSyncPauseMode(false);
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
    pointerMap.clear();
    liveSpeaker = null;
    setIsSyncPauseMode(false);
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
        socket.on("clientEmits", ({ name, type, subType, actionType, targetUser }) => {
            const user = users.get(socket.id);
            if (!user) {
                console.warn(`🛑 Rejected clientEmits — unknown socket ${socket.id}`);
                return;
            }
            updateUserActivity(socket.id);
            if (!["ear", "brain", "mouth", "mic"].includes(type)) {
                console.warn(`🌀 Invalid ListenerEmit type: ${type}`);
                return;
            }
            (0, routeAction_1.routeAction)({ name, type, subType, actionType, targetUser }, {
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
        });
        socket.on("logBar:update", ({ text, userName }) => {
            const user = users.get(socket.id);
            if (!user) {
                console.log(`🚫 Rejected logBar:update — unknown user (${socket.id})`);
                return;
            }
            updateUserActivity(socket.id);
            if (user.name !== liveSpeaker) {
                console.log(`🚫 Rejected logBar:update — ${user.name} is not live (liveSpeaker=${liveSpeaker})`);
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
            pointerMap.delete(user.name);
            (0, avatarManager_1.releaseAvatarByName)(user.name);
            setIsSyncPauseMode(false);
            for (const [from, to] of pointerMap.entries()) {
                if (to === user.name)
                    pointerMap.delete(from);
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
            const map = Array.from(pointerMap.entries()).map(([from, to]) => ({
                from,
                to,
            }));
            socket.emit("initial-pointer-map", map);
        }
        function sendCurrentLiveSpeaker(socket) {
            if (liveSpeaker) {
                socket.emit("live-speaker", { name: liveSpeaker });
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
            const candidates = Array.from(users.values());
            let newLiveSpeaker = null;
            for (const candidate of candidates) {
                const everyoneElse = candidates.filter((u) => u.name !== candidate.name);
                const allPointing = everyoneElse.every((u) => pointerMap.get(u.name) === candidate.name);
                const selfPointing = pointerMap.get(candidate.name) === candidate.name;
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
            if (newLiveSpeaker !== liveSpeaker) {
                liveSpeaker = newLiveSpeaker;
                if (liveSpeaker) {
                    emitActionLog(`🎤 All attention on ${liveSpeaker}. Going LIVE.`);
                    // 💡 Reset concent-mode users to regular listeners
                    for (const [socketId, user] of users.entries()) {
                        if (user.name !== liveSpeaker) {
                            user.state = "regular";
                            users.set(socketId, user);
                        }
                    }
                    setIsSyncPauseMode(false);
                    io.emit("live-speaker", { name: liveSpeaker });
                    io.emit("logBar:update", {
                        text: `${liveSpeaker}: `,
                        userName: liveSpeaker,
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

"use strict";
// socketHandler.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIsSyncPauseMode = getIsSyncPauseMode;
exports.setIsSyncPauseMode = setIsSyncPauseMode;
exports.getPointerMap = getPointerMap;
exports.getSessionStats = getSessionStats;
exports.getLiveSpeaker = getLiveSpeaker;
exports.setLiveSpeaker = setLiveSpeaker;
exports.getUsers = getUsers;
exports.setupSocketHandlers = setupSocketHandlers;
const avatarManager_1 = require("./avatarManager");
const gestureCatalog_1 = require("./ui-config/gestureCatalog");
const gesture_service_1 = require("./ui-config/gesture.service");
const routeAction_1 = require("./actions/routeAction"); // adjust path if needed
const panelConfigService_1 = require("./panelConfigService"); // or wherever you store them
const gliffLogService_1 = require("./gliffLogService");
const users = new Map(); // socketId -> { name, avatarId }
const sessionStartTime = new Date();
// Session utilities
function getSimpleSessionStats() {
    const currentTime = new Date();
    const sessionDuration = Math.floor((currentTime.getTime() - sessionStartTime.getTime()) / 1000);
    const userCount = users.size;
    const activeUsers = Array.from(users.values())
        .map((u) => u.name)
        .join(", ");
    return {
        userCount,
        activeUsers,
        sessionDuration,
        sessionStartTime: sessionStartTime.toISOString(),
    };
}
function formatSessionLog(message, type = "INFO") {
    const stats = getSimpleSessionStats();
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${type}] ${message} | Users: ${stats.userCount} (${stats.activeUsers || "none"}) | Session: ${Math.floor(stats.sessionDuration / 60)}m${stats.sessionDuration % 60}s`;
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
    const sessionDuration = Math.floor((currentTime.getTime() - sessionStartTime.getTime()) / 1000);
    const userCount = users.size;
    const activeUsers = Array.from(users.values()).map((u) => ({
        name: u.name,
        avatarId: u.avatarId,
        state: u.state,
        joinedAt: u.joinedAt,
        lastActivity: u.lastActivity,
        sessionDuration: Math.floor((currentTime.getTime() - u.joinedAt.getTime()) / 1000),
    }));
    return {
        userCount,
        activeUsers,
        sessionDuration,
        sessionStartTime: sessionStartTime.toISOString(),
        currentTime: currentTime.toISOString(),
    };
}
function getLiveSpeaker() {
    return liveSpeaker;
}
function setLiveSpeaker(name) {
    liveSpeaker = name;
}
function getUsers() {
    return users;
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
            const emoji = avatarManager_1.emojiLookup[avatarId] || "";
            console.log(formatSessionLog(`✅ ${emoji} ${name} joined as ${avatarId}`, "JOIN"));
            emitSystemLog(`👤 ${emoji} ${name} joined as ${avatarId}`);
            socket.emit("join-approved", { name, avatarId });
            broadcastUserList();
            broadcastAvatarState();
            sendInitialPointerMap(socket);
            sendCurrentLiveSpeaker(socket);
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
            console.log(`🛠️ Building panel config for ${userName}`);
            const config = (0, panelConfigService_1.getPanelConfigFor)(userName);
            // console.log(
            //   "[Server] Sending attention panel config:",
            //   JSON.stringify(config, null, 2)
            // );
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
            pointerMap.delete(user.name);
            (0, avatarManager_1.releaseAvatarByName)(user.name);
            setIsSyncPauseMode(false);
            for (const [from, to] of pointerMap.entries()) {
                if (to === user.name)
                    pointerMap.delete(from);
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
                        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
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

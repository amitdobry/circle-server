"use strict";
// socketHandler.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
const avatarManager_1 = require("./avatarManager");
const users = new Map(); // socketId -> { name, avatarId }
const pointerMap = new Map(); // from -> to
let liveSpeaker = null;
function setupSocketHandlers(io) {
    io.on("connection", (socket) => {
        console.log(`🪪 New connection: ${socket.id}`);
        socket.on("join", ({ name, avatarId }) => {
            users.set(socket.id, { name, avatarId });
            socket.on("joined-table", ({ name }) => {
                const avatar = users.get(socket.id)?.avatarId;
                const emoji = avatarManager_1.emojiLookup[avatar || ""] || "";
                logToConsole(`🪑 ${emoji} ${name} has fully entered the table`);
                sendCurrentUserListTo(socket); // send only to this socket
            });
            function sendCurrentUserListTo(socket) {
                const list = Array.from(users.values());
                socket.emit("user-list", list);
            }
            const claimed = (0, avatarManager_1.claimAvatar)(avatarId, name);
            if (!claimed) {
                console.warn(`⚠️ Avatar ${avatarId} is already taken`);
                socket.emit("avatar-claim-failed", { avatarId });
                return;
            }
            const emoji = avatarManager_1.emojiLookup[avatarId] || "";
            logToConsole(`👤 ${emoji} ${name} joined as ${avatarId}`);
            broadcastUserList();
            broadcastAvatarState();
            sendInitialPointerMap(socket);
            sendCurrentLiveSpeaker(socket);
        });
        socket.on("leave", ({ name }) => {
            logToConsole(`👋 ${name} left manually`);
            cleanupUser(socket);
        });
        socket.on("disconnect", () => {
            const user = users.get(socket.id);
            logToConsole(`❌ ${user?.name || "Unknown"} disconnected`);
            cleanupUser(socket);
        });
        socket.on("pointing", ({ from, to }) => {
            pointerMap.set(from, to);
            io.emit("update-pointing", { from, to });
            const avatarId = Array.from(users.values()).find((u) => u.name === from)?.avatarId || "";
            const emoji = avatarManager_1.emojiLookup[avatarId] || "";
            if (from === to) {
                logToConsole(`✋ ${emoji} ${from} wishes to speak`);
            }
            else {
                logToConsole(`🔁 ${emoji} ${from} ➡️ ${to}`);
            }
            evaluateSync();
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
        function logToConsole(msg) {
            io.emit("log-event", msg); // 🔥 everyone gets it
            console.log(msg);
        }
        function evaluateSync() {
            const candidates = Array.from(users.values());
            let newLiveSpeaker = null;
            for (const candidate of candidates) {
                const everyoneElse = candidates.filter((n) => n.name !== candidate.name);
                const allPointing = everyoneElse.every((n) => pointerMap.get(n.name) === candidate.name);
                const selfPointing = pointerMap.get(candidate.name) === candidate.name;
                if (allPointing && selfPointing) {
                    newLiveSpeaker = candidate.name;
                    break;
                }
            }
            if (newLiveSpeaker !== liveSpeaker) {
                liveSpeaker = newLiveSpeaker;
                if (liveSpeaker) {
                    logToConsole(`🎤 All attention on ${liveSpeaker}. Going LIVE.`);
                    io.emit("live-speaker", { name: liveSpeaker });
                }
                else {
                    logToConsole("🔇 No speaker in sync. Clearing Live tag.");
                    io.emit("live-speaker-cleared");
                }
            }
        }
    });
}

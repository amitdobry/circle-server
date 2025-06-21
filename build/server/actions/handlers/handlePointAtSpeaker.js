"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePointAtSpeaker = handlePointAtSpeaker;
const avatarManager_1 = require("../../avatarManager"); // adjust path if needed
function handlePointAtSpeaker(payload, context) {
    const { from, to } = payload;
    const { pointerMap, users, io, logAction, logSystem, evaluateSync } = context;
    if (!from || !to) {
        logSystem("🚨 Missing 'from' or 'to' in pointAtSpeaker payload.");
        return;
    }
    pointerMap.set(from, to);
    io.emit("update-pointing", { from, to });
    const avatarId = Array.from(users.values()).find((u) => u.name === from)?.avatarId || "";
    const emoji = avatarManager_1.emojiLookup[avatarId] || "";
    if (from === to) {
        logAction(`✋ ${emoji} ${from} wishes to speak`);
    }
    else {
        logAction(`🔁 ${emoji} ${from} ➡️ ${to}`);
    }
    evaluateSync();
}

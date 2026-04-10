"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWishToSpeakAfterMicDropped = handleWishToSpeakAfterMicDropped;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handleWishToSpeakAfterMicDropped(payload, context) {
    const { name } = payload;
    const { users, io, logSystem, logAction, evaluateSync } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleBreakSync payload.");
        return;
    }
    // ✅ 1. Set pointing and assign states
    for (const [socketId, user] of users.entries()) {
        const isCandidate = user.name === name;
        // Use setPointer/clearPointer so SpeakerManager stays in sync
        if (isCandidate) {
            (0, socketHandler_1.setPointer)(user.name, name);
        }
        else {
            (0, socketHandler_1.clearPointer)(user.name);
        }
        io.emit("update-pointing", {
            from: user.name,
            to: isCandidate ? name : null,
        });
        user.state = isCandidate
            ? "wantsToPickUpTheMic"
            : "appendingConcentToPickUpTheMic";
        users.set(socketId, user);
    }
    logAction(`✋ ${name} wishes to pick up the mic (post-drop)`);
    // setIsSyncPauseMode(true);
    // ✅ 2. Refresh UI for all users
    for (const [socketId, user] of users.entries()) {
        logSystem(`📦 Preparing panel for ${user.name} → ${user.state}`);
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
    // ✅ 3. Re-evaluate sync state
    evaluateSync();
}

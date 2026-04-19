"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWishToSpeakAfterMicDropped = handleWishToSpeakAfterMicDropped;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
const routeAction_1 = require("../routeAction");
function handleWishToSpeakAfterMicDropped(payload, context) {
    const { name } = payload;
    const { users, io, logSystem, logAction, roomId } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleBreakSync payload.");
        return;
    }
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    // ✅ 1. Set pointing and assign states
    for (const [socketId, user] of roomUsers.entries()) {
        const isCandidate = user.name === name;
        // Use setPointer/clearPointer so SpeakerManager stays in sync
        if (isCandidate) {
            (0, socketHandler_1.setPointer)(user.name, name, roomId);
        }
        else {
            (0, socketHandler_1.clearPointer)(user.name, roomId);
        }
        io.to(roomId).emit("update-pointing", {
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
    // Phase E: 2. Refresh UI for users in this room
    for (const [socketId, user] of roomUsers.entries()) {
        logSystem(`📦 Preparing panel for ${user.name} → ${user.state}`);
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

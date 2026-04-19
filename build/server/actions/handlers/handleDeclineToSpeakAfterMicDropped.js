"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDeclineToSpeakAfterMicDropped = handleDeclineToSpeakAfterMicDropped;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
const routeAction_1 = require("../routeAction");
function handleDeclineToSpeakAfterMicDropped(payload, context) {
    const { name } = payload;
    const { users, pointerMap, io, logSystem, logAction, roomId } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleBreakSync payload.");
        return;
    }
    let declinedCount = 1;
    let totalEligibleUsers = 0;
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    for (const [socketId, user] of roomUsers.entries()) {
        if (user.name === name) {
            (0, socketHandler_1.clearPointer)(user.name, roomId);
            io.to(roomId).emit("update-pointing", { from: user.name, to: null });
            user.state = "doesNotWantToPickUpTheMic";
        }
        // Count total listeners (exclude whoever dropped the mic)
        if (user.state !== "speaking") {
            totalEligibleUsers++;
            if (user.state === "doesNotWantToPickUpTheMic") {
                declinedCount++;
            }
        }
        users.set(socketId, user);
    }
    logAction(`✋ ${name} does not whish to pick up the mic (post-drop)`);
    // 🔍 Check if ALL listeners declined
    if (declinedCount === totalEligibleUsers && totalEligibleUsers > 0) {
        logAction(`📢 No one stepped up to take the mic — returning to attention phase`);
        (0, socketHandler_1.setIsSyncPauseMode)(false);
        // Phase E: Optional: reset state and emit new panels (in this room)
        for (const [socketId, user] of roomUsers.entries()) {
            user.state = "regular";
            (0, socketHandler_1.clearPointer)(user.name, roomId);
            const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
            io.to(socketId).emit("receive:panelConfig", config);
        }
        return;
    }
    for (const [socketId, user] of roomUsers.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

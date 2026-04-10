"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOfferMicToUserFromPassTheMic = handleOfferMicToUserFromPassTheMic;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handleOfferMicToUserFromPassTheMic(payload, context) {
    const { name, targetUser } = payload;
    const { users, pointerMap, io, logSystem, logAction } = context;
    if (!name || !targetUser) {
        logSystem("🚨 Missing name or targetUser in mic pass handler");
        return;
    }
    logAction(`🎤 ${name} offered the mic to ${targetUser}`);
    // Then use users map to update states accordingly
    for (const [socketId, user] of users.entries()) {
        if (user.name === name) {
            user.state = "hasOfferedMicToUserFromPassTheMic";
        }
        else if (user.name === targetUser) {
            user.state = "micOfferReceivedFromPassTheMic";
        }
        else {
            user.state = "awaitingUserMicOfferResolutionFromPassTheMic";
        }
        users.set(socketId, user);
    }
    // 👆 Set pointer and update state
    (0, socketHandler_1.setPointer)(name, targetUser);
    io.emit("update-pointing", { from: name, to: targetUser });
    (0, socketHandler_1.setIsSyncPauseMode)(true);
    // Emit updates
    for (const [socketId, user] of users.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

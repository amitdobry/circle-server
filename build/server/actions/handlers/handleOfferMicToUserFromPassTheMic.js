"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOfferMicToUserFromPassTheMic = handleOfferMicToUserFromPassTheMic;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
const routeAction_1 = require("../routeAction");
function handleOfferMicToUserFromPassTheMic(payload, context) {
    const { name, targetUser } = payload;
    const { users, pointerMap, io, logSystem, logAction, roomId } = context;
    if (!name || !targetUser) {
        logSystem("🚨 Missing name or targetUser in mic pass handler");
        return;
    }
    logAction(`🎤 ${name} offered the mic to ${targetUser}`);
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    // Then use users map to update states accordingly
    for (const [socketId, user] of roomUsers.entries()) {
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
    (0, socketHandler_1.setPointer)(name, targetUser, roomId);
    io.to(roomId).emit("update-pointing", { from: name, to: targetUser });
    (0, socketHandler_1.setIsSyncPauseMode)(true, roomId);
    // Clear live speaker — the interrupter has chosen a candidate,
    // the previous speaker's authority is suspended from this point.
    // (In V1 this was handled by evaluateSync detecting broken consensus.)
    (0, socketHandler_1.setLiveSpeaker)(null, roomId);
    // Emit updates
    for (const [socketId, user] of roomUsers.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name, roomId);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDeclineNewCandidateRequestAfterMicDropped = handleDeclineNewCandidateRequestAfterMicDropped;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
const routeAction_1 = require("../routeAction");
function handleDeclineNewCandidateRequestAfterMicDropped(payload, context) {
    const { name } = payload;
    const { users, pointerMap, io, logAction, logSystem, roomId } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleBreakSync payload.");
        return;
    }
    let MicPickerProspect = "";
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    for (const [socketId, user] of roomUsers.entries()) {
        if (user.name === name) {
            (0, socketHandler_1.clearPointer)(user.name, roomId);
            io.to(roomId).emit("update-pointing", { from: user.name, to: null });
        }
        if (user.state === "wantsToPickUpTheMic") {
            MicPickerProspect = user.name;
        }
        users.set(socketId, user);
    }
    logAction(`✋ ${name} declined ${MicPickerProspect} to pick up the mic, shifting back to attention selector`);
    // Clear all pointers and live speaker so V2 pointerMap is clean
    // for the next attention-selection round
    for (const [, user] of roomUsers.entries()) {
        (0, socketHandler_1.clearPointer)(user.name, roomId);
        io.to(roomId).emit("update-pointing", { from: user.name, to: null });
    }
    (0, socketHandler_1.setLiveSpeaker)(null, roomId);
    (0, socketHandler_1.setIsSyncPauseMode)(false);
    // Phase E: Optional: reset state and emit new panels (in this room)
    for (const [socketId, user] of roomUsers.entries()) {
        user.state = "regular";
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
    return;
}

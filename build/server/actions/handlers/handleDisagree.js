"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDisagree = handleDisagree;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
const routeAction_1 = require("../routeAction");
function handleDisagree(payload, context) {
    const { name } = payload;
    const { users, pointerMap, io, logAction, logSystem, roomId } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleDisagree payload.");
        return;
    }
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    for (const [socketId, user] of roomUsers.entries()) {
        // Phase E: Reset pointing for users in this room
        (0, socketHandler_1.clearPointer)(name, roomId);
        io.to(roomId).emit("update-pointing", { from: name, to: null });
        user.state = "regular";
        users.set(socketId, user);
    }
    // 🔍 Go back to attention selector mode (like declining mic offer)
    (0, socketHandler_1.setIsSyncPauseMode)(false);
    (0, socketHandler_1.setLiveSpeaker)(null, roomId);
    logAction(`❌ ${name} disagreed - going back to attention selector`);
    // Phase E: Reset users in this room to regular state and emit new panels
    for (const [socketId, user] of roomUsers.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

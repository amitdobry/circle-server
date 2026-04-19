"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDropTheMic = handleDropTheMic;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
const routeAction_1 = require("../routeAction");
function handleDropTheMic(payload, context) {
    const { name } = payload;
    const { users, pointerMap, io, logAction, logSystem, roomId } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleBreakSync payload.");
        return;
    }
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    // Phase E: Now update states (in this room):
    for (const [socketId, user] of roomUsers.entries()) {
        if (user.name === name) {
            (0, socketHandler_1.clearPointer)(name, roomId);
            io.to(roomId).emit("update-pointing", { from: name, to: null });
            user.state = "hasDroppedTheMic";
        }
        else {
            (0, socketHandler_1.clearPointer)(user.name, roomId);
            io.to(roomId).emit("update-pointing", { from: user.name, to: null });
            user.state = "micIsDropped";
        }
        users.set(socketId, user);
    }
    logAction(`👄 ${name} dropped the mic (breakSync)`);
    (0, socketHandler_1.setLiveSpeaker)(null, roomId);
    (0, socketHandler_1.setIsSyncPauseMode)(true);
    for (const [socketId, user] of roomUsers.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        // console.logAction(
        //   "[Server] Sending config panel from handleWishToSpeak config:",
        //   JSON.stringify(config, null, 2)
        // );
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

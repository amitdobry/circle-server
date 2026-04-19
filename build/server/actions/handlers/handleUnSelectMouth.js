"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUnselectMouth = handleUnselectMouth;
const routeAction_1 = require("../routeAction");
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handleUnselectMouth(payload, context) {
    const { name } = payload;
    const { users, io, logSystem, logAction, roomId } = context;
    if (!name) {
        logSystem("🚨 Missing name in unselect payload");
        return;
    }
    logAction(`↩️ ${name} unselected mouth gesture`);
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    // Reset all listeners to "regular"
    for (const [socketId, user] of roomUsers.entries()) {
        if (user.name === name || user.state === "waiting") {
            user.state = "regular";
            users.set(socketId, user);
        }
    }
    // Phase E: Reset speaker's `interruptedBy` field (in this room)
    const liveSpeakerName = (0, socketHandler_1.getLiveSpeaker)(roomId);
    const speakerEntry = liveSpeakerName
        ? Array.from(roomUsers.entries()).find(([, user]) => user.name === liveSpeakerName)
        : undefined;
    if (speakerEntry) {
        const [socketId, speakerUser] = speakerEntry;
        speakerUser.interruptedBy = "";
        users.set(socketId, speakerUser);
    }
    // Phase E: Emit updated config to users in this room only
    for (const [socketId, user] of roomUsers.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

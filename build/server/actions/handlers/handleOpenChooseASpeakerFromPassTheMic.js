"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOpenChooseASpeakerFromPassTheMic = handleOpenChooseASpeakerFromPassTheMic;
const routeAction_1 = require("../routeAction");
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handleOpenChooseASpeakerFromPassTheMic(payload, context) {
    const { name } = payload;
    const { users, io, logSystem, logAction, roomId } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleOpenChooseASpeakerFromPassTheMic payload.");
        return;
    }
    logAction(`🎯 ${name} is choosing a user to pass the mic to.`);
    // Speaker is no longer "live" — clear so panelBuilderRouter routes
    // them to buildListenerSyncPanel → state-13 (participant picker)
    (0, socketHandler_1.setLiveSpeaker)(null, roomId);
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    for (const [socketId, user] of roomUsers.entries()) {
        if (user.name === name) {
            user.state = "isChoosingUserToPassMic";
            users.set(socketId, user);
        }
    }
    for (const [socketId, user] of roomUsers.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

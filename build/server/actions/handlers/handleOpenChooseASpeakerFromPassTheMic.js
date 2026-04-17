"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOpenChooseASpeakerFromPassTheMic = handleOpenChooseASpeakerFromPassTheMic;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handleOpenChooseASpeakerFromPassTheMic(payload, context) {
    const { name } = payload;
    const { users, io, logSystem, logAction } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleOpenChooseASpeakerFromPassTheMic payload.");
        return;
    }
    logAction(`🎯 ${name} is choosing a user to pass the mic to.`);
    // Speaker is no longer "live" — clear so panelBuilderRouter routes
    // them to buildListenerSyncPanel → state-13 (participant picker)
    (0, socketHandler_1.setLiveSpeaker)(null);
    for (const [socketId, user] of users.entries()) {
        if (user.name === name) {
            user.state = "isChoosingUserToPassMic";
            users.set(socketId, user);
        }
    }
    for (const [socketId, user] of users.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

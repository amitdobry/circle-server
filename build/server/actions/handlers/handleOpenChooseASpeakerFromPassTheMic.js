"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOpenChooseASpeakerFromPassTheMic = handleOpenChooseASpeakerFromPassTheMic;
const panelConfigService_1 = require("../../panelConfigService");
function handleOpenChooseASpeakerFromPassTheMic(payload, context) {
    const { name } = payload;
    const { users, io, log, evaluateSync } = context;
    if (!name) {
        log("🚨 Missing name in handleOpenChooseASpeakerFromPassTheMic payload.");
        return;
    }
    log(`🎯 ${name} is choosing a user to pass the mic to.`);
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
    evaluateSync();
}

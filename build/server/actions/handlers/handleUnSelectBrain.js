"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUnSelectBrain = handleUnSelectBrain;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handleUnSelectBrain(payload, context) {
    const { name } = payload;
    const { users, io, logSystem, logAction } = context;
    if (!name) {
        logSystem("🚨 Missing name in unselect payload");
        return;
    }
    logAction(`↩️ ${name} unselected Brain gesture`);
    // Reset all listeners to "regular"
    for (const [socketId, user] of users.entries()) {
        if (user.name === name || user.state === "waiting") {
            user.state = "regular";
            users.set(socketId, user);
        }
    }
    // 🔁 Reset speaker's `interruptedBy` field
    const liveSpeakerName = (0, socketHandler_1.getLiveSpeaker)();
    const speakerEntry = liveSpeakerName
        ? Array.from(users.entries()).find(([, user]) => user.name === liveSpeakerName)
        : undefined;
    if (speakerEntry) {
        const [socketId, speakerUser] = speakerEntry;
        speakerUser.interruptedBy = "";
        users.set(socketId, speakerUser);
    }
    // Emit updated config to all
    for (const [socketId, user] of users.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

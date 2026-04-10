"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDisagree = handleDisagree;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handleDisagree(payload, context) {
    const { name } = payload;
    const { users, pointerMap, io, logAction, logSystem } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleDisagree payload.");
        return;
    }
    for (const [socketId, user] of users.entries()) {
        // 🔄 Reset pointing for the disagreeing user and all other users
        (0, socketHandler_1.clearPointer)(name);
        io.emit("update-pointing", { from: name, to: null });
        user.state = "regular";
        users.set(socketId, user);
    }
    // 🔍 Go back to attention selector mode (like declining mic offer)
    (0, socketHandler_1.setIsSyncPauseMode)(false);
    (0, socketHandler_1.setLiveSpeaker)(null);
    logAction(`❌ ${name} disagreed - going back to attention selector`);
    // 🔄 Reset all users to regular state and emit new panels
    for (const [socketId, user] of users.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

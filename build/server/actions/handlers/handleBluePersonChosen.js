"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBluePersonChosen = handleBluePersonChosen;
const panelConfigService_1 = require("../../panelConfigService");
function handleBluePersonChosen(payload, context) {
    const { name, targetUser, flavor } = payload;
    const { users, io, logAction, logSystem } = context;
    if (!name || !targetUser) {
        logSystem("🟦 handleBluePersonChosen: missing name or targetUser");
        return;
    }
    logAction(`🟦 ${name} chose ${targetUser} (${flavor ?? "no flavor"})`);
    // Reset picker back to regular listener state
    for (const [socketId, user] of users.entries()) {
        if (user.name === name) {
            user.state = "regular";
            users.set(socketId, user);
            const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
            io.to(socketId).emit("receive:panelConfig", config);
            return;
        }
    }
    logSystem(`🟦 handleBluePersonChosen: user "${name}" not found in room`);
}

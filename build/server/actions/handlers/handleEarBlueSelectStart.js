"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEarBlueSelectStart = handleEarBlueSelectStart;
const panelConfigService_1 = require("../../panelConfigService");
function handleEarBlueSelectStart(payload, context) {
    const { name, flavor } = payload;
    const { users, io, logAction, logSystem } = context;
    if (!name) {
        logSystem("🟦 handleEarBlueSelectStart: missing name in payload");
        return;
    }
    for (const [socketId, user] of users.entries()) {
        if (user.name === name) {
            user.state = "isPickingEarBluePerson";
            users.set(socketId, user);
            logAction(`🟦 ${name} opened ear-blue picker${flavor ? ` (${flavor})` : ""}`);
            const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
            io.to(socketId).emit("receive:panelConfig", config);
            return;
        }
    }
    logSystem(`🟦 handleEarBlueSelectStart: user "${name}" not found in room`);
}

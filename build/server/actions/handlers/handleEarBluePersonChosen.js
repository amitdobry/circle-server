"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEarBluePersonChosen = handleEarBluePersonChosen;
const panelConfigService_1 = require("../../panelConfigService");
const gliffLogService_1 = require("../../gliffLogService");
function handleEarBluePersonChosen(payload, context) {
    const { name, targetUser } = payload;
    const { users, io, logAction, logSystem } = context;
    if (!name || !targetUser) {
        logSystem("🟦 handleEarBluePersonChosen: missing name or targetUser");
        return;
    }
    const label = `I'd love to hear from '${targetUser}'`;
    logAction(`🟦 ${name}: ${label}`);
    (0, gliffLogService_1.createGliffLog)({
        userName: name,
        message: {
            messageType: "gesture",
            content: label,
            emoji: "🙋",
            timestamp: Date.now(),
        },
    }, io, "default-room");
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
    logSystem(`🟦 handleEarBluePersonChosen: user "${name}" not found in room`);
}

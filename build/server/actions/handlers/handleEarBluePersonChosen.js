"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEarBluePersonChosen = handleEarBluePersonChosen;
// handlers/handleEarBluePersonChosen.ts
// Called when a listener in "isPickingEarBluePerson" state clicks a participant name.
// payload.name       = the picker
// payload.targetUser = the participant they chose to hear from
const routeAction_1 = require("../routeAction");
const panelConfigService_1 = require("../../panelConfigService");
const gliffLogService_1 = require("../../gliffLogService");
function handleEarBluePersonChosen(payload, context) {
    const { name, targetUser } = payload;
    const { users, io, logAction, logSystem, roomId } = context;
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
    }, io, roomId);
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    // Reset picker back to regular listener state
    for (const [socketId, user] of roomUsers.entries()) {
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBluePersonChosen = handleBluePersonChosen;
// handlers/handleBluePersonChosen.ts
// Called when a listener in "isPickingBlueSpeaker" state clicks a participant name.
// payload.name      = the picker (the listener who initiated)
// payload.targetUser = the participant they chose to hear from
const routeAction_1 = require("../routeAction");
const panelConfigService_1 = require("../../panelConfigService");
function handleBluePersonChosen(payload, context) {
    const { name, targetUser, flavor } = payload;
    const { users, io, logAction, logSystem, roomId } = context;
    if (!name || !targetUser) {
        logSystem("🟦 handleBluePersonChosen: missing name or targetUser");
        return;
    }
    logAction(`🟦 ${name} chose ${targetUser} (${flavor ?? "no flavor"})`);
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
    logSystem(`🟦 handleBluePersonChosen: user "${name}" not found in room`);
}

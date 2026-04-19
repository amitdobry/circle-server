"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEarBlueSelectStart = handleEarBlueSelectStart;
// handlers/handleEarBlueSelectStart.ts
// Called when a listener clicks a blue button in the Ear group (e.g. "I'd love to hear…").
// This opens a private picker panel for that listener only — no sync pause, nobody else affected.
const routeAction_1 = require("../routeAction");
const panelConfigService_1 = require("../../panelConfigService");
function handleEarBlueSelectStart(payload, context) {
    const { name, flavor } = payload;
    const { users, io, logAction, logSystem, roomId } = context;
    if (!name) {
        logSystem("🟦 handleEarBlueSelectStart: missing name in payload");
        return;
    }
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    for (const [socketId, user] of roomUsers.entries()) {
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSelectEar = handleSelectEar;
const routeAction_1 = require("../routeAction");
const avatarManager_1 = require("../../avatarManager"); // adjust path if needed
const panelConfigService_1 = require("../../panelConfigService");
function handleSelectEar(payload, context) {
    const { name: earClickerName } = payload;
    const { users, io, logSystem, logAction, roomId } = context;
    if (!earClickerName) {
        logSystem("🚨 Missing 'name' in selectEar payload.");
        return;
    }
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    const avatarId = Array.from(roomUsers.values()).find((u) => u.name === earClickerName)
        ?.avatarId ?? "";
    const emoji = avatarManager_1.emojiLookup[avatarId] || "";
    logAction(` ${emoji} ${earClickerName} clicked ear — he might relate`);
    // Phase E: Now update states (in this room):
    for (const [socketId, user] of roomUsers.entries()) {
        if (user.name === earClickerName && user.state !== "hasClickedEar") {
            user.state = "hasClickedEar";
            users.set(socketId, user);
        }
    }
    // Emit updated config only to the user who clicked ear
    const userEntry = Array.from(roomUsers.entries()).find(([, user]) => user.name === earClickerName);
    if (userEntry) {
        const [socketId, user] = userEntry;
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

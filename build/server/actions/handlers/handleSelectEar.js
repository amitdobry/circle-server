"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSelectEar = handleSelectEar;
const avatarManager_1 = require("../../avatarManager"); // adjust path if needed
const panelConfigService_1 = require("../../panelConfigService");
function handleSelectEar(payload, context) {
    const { name: earClickerName } = payload;
    const { users, io, logSystem, logAction } = context;
    if (!earClickerName) {
        logSystem("🚨 Missing 'name' in selectEar payload.");
        return;
    }
    const avatarId = Array.from(users.values()).find((u) => u.name === earClickerName)
        ?.avatarId ?? "";
    const emoji = avatarManager_1.emojiLookup[avatarId] || "";
    logAction(` ${emoji} ${earClickerName} clicked ear — he might relate`);
    // ✅ Now update all states:
    for (const [socketId, user] of users.entries()) {
        if (user.name === earClickerName && user.state !== "hasClickedEar") {
            user.state = "hasClickedEar";
            users.set(socketId, user);
        }
    }
    // Emit updated config only to the user who unselected
    const userEntry = Array.from(users.entries()).find(([, user]) => user.name === earClickerName);
    if (userEntry) {
        const [socketId, user] = userEntry;
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

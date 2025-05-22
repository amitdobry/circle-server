"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSelectBrain = handleSelectBrain;
const avatarManager_1 = require("../../avatarManager"); // adjust path if needed
const panelConfigService_1 = require("../../panelConfigService");
function handleSelectBrain(payload, context) {
    const { name: brainClickerName } = payload;
    const { users, io, log, evaluateSync } = context;
    if (!brainClickerName) {
        log("🚨 Missing 'name' in selectMouth payload.");
        return;
    }
    const avatarId = Array.from(users.values()).find((u) => u.name === brainClickerName)
        ?.avatarId || "";
    const emoji = avatarManager_1.emojiLookup[avatarId] || "";
    log(`✋ ${emoji} ${brainClickerName} clicked brain — requesting to interrupt`);
    // ✅ Find the speaker FIRST (before changing any states)
    const speakerEntry = Array.from(users.entries()).find(([, user]) => user.state === "speaking");
    // ✅ Now update all states:
    for (const [socketId, user] of users.entries()) {
        if (user.name === brainClickerName) {
            user.state = "hasClickedBrain";
        }
        else {
            user.state = "waiting";
        }
        users.set(socketId, user);
    }
    // ✅ Set `interruptedBy` on the speaker
    if (speakerEntry) {
        const [speakerSocketId, speakerUser] = speakerEntry;
        speakerUser.interruptedBy = brainClickerName;
        users.set(speakerSocketId, speakerUser);
    }
    // ✅ Re-render panel configs for everyone
    for (const [socketId, user] of users.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
    evaluateSync(); // (optional: may not be needed for this flow)
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSelectMouth = handleSelectMouth;
const routeAction_1 = require("../routeAction");
const avatarManager_1 = require("../../avatarManager"); // adjust path if needed
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handleSelectMouth(payload, context) {
    const { name: mouthClickerName } = payload;
    const { users, io, logAction, logSystem, roomId } = context;
    if (!mouthClickerName) {
        logSystem("🚨 Missing 'name' in selectMouth payload.");
        return;
    }
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    const avatarId = Array.from(roomUsers.values()).find((u) => u.name === mouthClickerName)
        ?.avatarId || "";
    const emoji = avatarManager_1.emojiLookup[avatarId] || "";
    logAction(`✋ ${emoji} ${mouthClickerName} clicked mouth — requesting to interrupt`);
    // Phase E: Find the speaker FIRST (before changing any states)
    const liveSpeakerName = (0, socketHandler_1.getLiveSpeaker)(roomId);
    const speakerEntry = liveSpeakerName
        ? Array.from(roomUsers.entries()).find(([, user]) => user.name === liveSpeakerName)
        : undefined;
    // Phase E: Now update all states (in this room):
    for (const [socketId, user] of roomUsers.entries()) {
        if (user.name === mouthClickerName) {
            user.state = "hasClickedMouth";
        }
        else {
            user.state = "waiting";
        }
        users.set(socketId, user); // Update in global map
    }
    // ✅ Set `interruptedBy` on the speaker
    if (speakerEntry) {
        const [speakerSocketId, speakerUser] = speakerEntry;
        speakerUser.interruptedBy = mouthClickerName;
        users.set(speakerSocketId, speakerUser);
    }
    // Phase E: Re-render panel configs for users in this room only
    for (const [socketId, user] of roomUsers.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

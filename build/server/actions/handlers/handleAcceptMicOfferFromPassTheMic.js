"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAcceptMicOfferFromPassTheMic = handleAcceptMicOfferFromPassTheMic;
const routeAction_1 = require("../routeAction");
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handleAcceptMicOfferFromPassTheMic(payload, context) {
    const { name } = payload;
    const { users, io, logAction, logSystem, pointerMap, roomId } = context;
    if (!name) {
        logSystem("🚨 Missing name in acceptMicOffer handler.");
        return;
    }
    logSystem(`🙋 ${name} accepted the mic — starting group consent process.`);
    let originalSpeakerName = undefined;
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    // Step 1: Assign states
    for (const [socketId, user] of roomUsers.entries()) {
        // 🙋 Target user who accepted
        if (user.name === name) {
            user.state = "wantsToPickUpTheMic";
            (0, socketHandler_1.setPointer)(user.name, user.name, roomId); // Point to self
        }
        // 🧘 Speaker who previously offered - they auto-consent
        else if (user.state === "hasOfferedMicToUserFromPassTheMic") {
            user.state = "waitingForOthersAfterMicDropAndConcentNewSpeaker";
            originalSpeakerName = user.name;
            // ✅ FIX: Original speaker automatically points at the target they chose
            (0, socketHandler_1.setPointer)(user.name, name, roomId);
            io.to(roomId).emit("update-pointing", { from: user.name, to: name });
        }
        // 👂 Everyone else
        else {
            user.state = "appendingConcentToPickUpTheMic";
        }
        users.set(socketId, user);
    }
    // Step 2: Check if consensus is already complete (2-user scenario)
    const remainingConsenters = Array.from(roomUsers.values()).filter((u) => u.state === "appendingConcentToPickUpTheMic").length;
    if (remainingConsenters === 0) {
        // 🎉 Consensus complete — new speaker goes LIVE (no others to wait for)
        logSystem(`🎉 Immediate consensus for ${name} (no other users to consent)`);
        // Reset V1 user states before panel rebuild
        for (const [sid, user] of roomUsers.entries()) {
            user.state = user.name === name ? "speaking" : "regular";
            users.set(sid, user);
        }
        // Sync V1 globals so panelBuilderRouter routes correctly
        (0, socketHandler_1.setLiveSpeaker)(name, roomId);
        (0, socketHandler_1.setIsSyncPauseMode)(false, roomId);
        // Emit panels
        for (const [socketId, user] of roomUsers.entries()) {
            const config = (0, panelConfigService_1.getPanelConfigFor)(user.name, roomId);
            io.to(socketId).emit("receive:panelConfig", config);
        }
    }
    else {
        // Not yet consensus — emit intermediate panels (waiting for others)
        for (const [socketId, user] of roomUsers.entries()) {
            const config = (0, panelConfigService_1.getPanelConfigFor)(user.name, roomId);
            io.to(socketId).emit("receive:panelConfig", config);
        }
    }
}

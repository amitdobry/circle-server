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
    let postSpeakerName = undefined;
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    // Step 1: Assign states
    for (const [socketId, user] of roomUsers.entries()) {
        // 🙋 Target user who accepted
        if (user.name === name) {
            user.state = "wantsToPickUpTheMic";
            (0, socketHandler_1.setPointer)(user.name, user.name, roomId); // ✅ Point to self
        }
        // 🧘 Speaker who previously offered
        else if (user.state === "hasOfferedMicToUserFromPassTheMic") {
            user.state = "waitingForOthersAfterMicDropAndConcentNewSpeaker";
            postSpeakerName = user.name;
        }
        // 👂 Everyone else
        else {
            user.state = "appendingConcentToPickUpTheMic";
        }
        users.set(socketId, user);
    }
    // Step 2: Emit updated panels
    for (const [socketId, user] of roomUsers.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

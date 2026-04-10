"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAcceptMicOfferFromPassTheMic = handleAcceptMicOfferFromPassTheMic;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handleAcceptMicOfferFromPassTheMic(payload, context) {
    const { name } = payload;
    const { users, io, logAction, logSystem, evaluateSync, pointerMap } = context;
    if (!name) {
        logSystem("🚨 Missing name in acceptMicOffer handler.");
        return;
    }
    logSystem(`🙋 ${name} accepted the mic — starting group consent process.`);
    let postSpeakerName = undefined;
    // Step 1: Assign states
    for (const [socketId, user] of users.entries()) {
        // 🙋 Target user who accepted
        if (user.name === name) {
            user.state = "wantsToPickUpTheMic";
            (0, socketHandler_1.setPointer)("default-room", user.name, user.name); // ✅ Point to self
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
    for (const [socketId, user] of users.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
    evaluateSync(); // ✅ Trigger sync check
}

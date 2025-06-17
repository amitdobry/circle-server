"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAcceptMicOfferFromPassTheMic = handleAcceptMicOfferFromPassTheMic;
const panelConfigService_1 = require("../../panelConfigService");
function handleAcceptMicOfferFromPassTheMic(payload, context) {
    const { name } = payload;
    const { users, io, log, evaluateSync, pointerMap } = context;
    if (!name) {
        log("🚨 Missing name in acceptMicOffer handler.");
        return;
    }
    log(`🙋 ${name} accepted the mic — starting group consent process.`);
    let postSpeakerName = undefined;
    // Step 1: Assign states
    for (const [socketId, user] of users.entries()) {
        // 🙋 Target user who accepted
        if (user.name === name) {
            user.state = "wantsToPickUpTheMic";
            pointerMap.set(user.name, user.name); // ✅ Point to self
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleConcentNewSpeakerFromMicDropped = handleConcentNewSpeakerFromMicDropped;
const panelConfigService_1 = require("../../panelConfigService");
function handleConcentNewSpeakerFromMicDropped(payload, context) {
    const { name } = payload;
    const { users, pointerMap, io, log, evaluateSync } = context;
    if (!name) {
        log("🚨 Missing name in handleConcentNewSpeakerFromMicDropped payload.");
        return;
    }
    let speakerCandidate = null;
    let socketIdOfResponder = null;
    // 🧠 Find responder socket ID and the first "wantsToPickUpTheMic" user
    for (const [socketId, user] of users.entries()) {
        log(`🔍 SCAN [${socketId}] ${user.name} → state: ${user.state}`);
        if (user.name === name) {
            socketIdOfResponder = socketId;
        }
        if (!speakerCandidate && user.state === "wantsToPickUpTheMic") {
            speakerCandidate = user.name;
        }
    }
    if (!speakerCandidate || !socketIdOfResponder) {
        log("🚨 Could not find speakerCandidate or responder.");
        return;
    }
    // 👆 Set pointer and update state
    pointerMap.set(name, speakerCandidate);
    io.emit("update-pointing", { from: name, to: speakerCandidate });
    const responder = users.get(socketIdOfResponder);
    if (responder) {
        responder.state = "waitingForOthersAfterMicDropAndConcentNewSpeaker";
        users.set(socketIdOfResponder, responder);
    }
    log(`👂 ${name} gave consent for ${speakerCandidate} to pick up the mic`);
    // 🔁 Refresh panels for everyone
    for (const [socketId, user] of users.entries()) {
        log(`📦 Preparing panel for ${user.name} → ${user.state}`);
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
    // 🔄 Re-check group sync
    evaluateSync();
}

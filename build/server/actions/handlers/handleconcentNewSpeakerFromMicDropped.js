"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleConcentNewSpeakerFromMicDropped = handleConcentNewSpeakerFromMicDropped;
const panelConfigService_1 = require("../../panelConfigService");
const routeAction_1 = require("../routeAction");
const socketHandler_1 = require("../../socketHandler");
function handleConcentNewSpeakerFromMicDropped(payload, context) {
    const { name } = payload;
    const { users, pointerMap, io, logAction, logSystem, roomId } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleConcentNewSpeakerFromMicDropped payload.");
        return;
    }
    let speakerCandidate = null;
    let socketIdOfResponder = null;
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    // 🧠 Find responder socket ID and the first "wantsToPickUpTheMic" user
    for (const [socketId, user] of roomUsers.entries()) {
        logSystem(`🔍 SCAN [${socketId}] ${user.name} → state: ${user.state}`);
        if (user.name === name) {
            socketIdOfResponder = socketId;
        }
        if (!speakerCandidate && user.state === "wantsToPickUpTheMic") {
            speakerCandidate = user.name;
        }
    }
    if (!speakerCandidate || !socketIdOfResponder) {
        logSystem("🚨 Could not find speakerCandidate or responder.");
        return;
    }
    // 👆 Set pointer and update state
    (0, socketHandler_1.setPointer)(name, speakerCandidate, roomId);
    io.to(roomId).emit("update-pointing", { from: name, to: speakerCandidate });
    const responder = users.get(socketIdOfResponder);
    if (responder) {
        responder.state = "waitingForOthersAfterMicDropAndConcentNewSpeaker";
        users.set(socketIdOfResponder, responder);
    }
    logAction(`👂 ${name} gave consent for ${speakerCandidate} to pick up the mic`);
    // Phase E: 🔁 Refresh panels for users in this room
    for (const [socketId, user] of roomUsers.entries()) {
        logAction(`📦 Preparing panel for ${user.name} → ${user.state}`);
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

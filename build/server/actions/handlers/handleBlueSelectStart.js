"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBlueSelectStart = handleBlueSelectStart;
const socketHandler_1 = require("../../socketHandler");
const panelConfigService_1 = require("../../panelConfigService");
function handleBlueSelectStart(payload, context) {
    const { name, flavor } = payload;
    const { users, pointerMap, io, logAction, logSystem, evaluateSync } = context;
    if (!name) {
        logSystem("🟦 handleBlueSelectStart: missing name in payload");
        return;
    }
    if (!flavor) {
        logSystem("🟦 handleBlueSelectStart: missing flavor in payload");
        return;
    }
    const speaker = Array.from(users.values()).find((u) => u.state === "speaking");
    if (!speaker) {
        logSystem(`🟦 handleBlueSelectStart: no current speaker in session 123`);
        return;
    }
    pointerMap.set(name, null);
    io.emit("update-pointing", { from: name, to: null });
    // ✅ Now update all states:
    for (const [socketId, user] of users.entries()) {
        if (user.name === name) {
            user.state = "isPickingBlueSpeaker";
        }
        else if (user.state === "speaking") {
            user.state = "postSpeakerWaitingOnBlue";
        }
        else {
            user.state = "waitingOnPickerOfBlueSpeaker";
        }
        users.set(socketId, user);
    }
    logAction(`👄 ${name} dropped the mic (breakSync)`);
    (0, socketHandler_1.setIsSyncPauseMode)(true);
    logAction(`🟦 ${name} started Blue select${flavor ? ` (${flavor})` : ""}`);
    for (const [socketId, user] of users.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

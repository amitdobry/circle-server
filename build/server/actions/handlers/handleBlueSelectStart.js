"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBlueSelectStart = handleBlueSelectStart;
// handlers/handleBlueSelectStart.ts
const routeAction_1 = require("../routeAction");
const socketHandler_1 = require("../../socketHandler");
const panelConfigService_1 = require("../../panelConfigService");
function handleBlueSelectStart(payload, context) {
    const { name, flavor } = payload;
    const { users, pointerMap, io, logAction, logSystem, roomId } = context;
    if (!name) {
        logSystem("🟦 handleBlueSelectStart: missing name in payload");
        return;
    }
    if (!flavor) {
        logSystem("🟦 handleBlueSelectStart: missing flavor in payload");
        return;
    }
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    const liveSpeakerName = (0, socketHandler_1.getLiveSpeaker)(roomId);
    const speaker = liveSpeakerName
        ? Array.from(roomUsers.values()).find((u) => u.name === liveSpeakerName)
        : null;
    if (!speaker) {
        logSystem(`🟦 handleBlueSelectStart: no current speaker in room`);
        return;
    }
    (0, socketHandler_1.clearPointer)(name, roomId);
    io.to(roomId).emit("update-pointing", { from: name, to: null });
    // Phase E: Now update states (in this room):
    for (const [socketId, user] of roomUsers.entries()) {
        if (user.name === name) {
            user.state = "isPickingBlueSpeaker";
        }
        else if (user.name === speaker.name) {
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
    for (const [socketId, user] of roomUsers.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
}

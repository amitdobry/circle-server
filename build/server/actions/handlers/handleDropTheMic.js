"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDropTheMic = handleDropTheMic;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handleDropTheMic(payload, context) {
    const { name } = payload;
    const { users, pointerMap, io, logAction, logSystem, evaluateSync } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleBreakSync payload.");
        return;
    }
    // ✅ Now update all states:
    for (const [socketId, user] of users.entries()) {
        if (user.name === name) {
            pointerMap.set(name, null);
            io.emit("update-pointing", { from: name, to: null });
            user.state = "hasDroppedTheMic";
        }
        else {
            pointerMap.set(user.name, null);
            io.emit("update-pointing", { from: user.name, to: null });
            user.state = "micIsDropped";
        }
        users.set(socketId, user);
    }
    logAction(`👄 ${name} dropped the mic (breakSync)`);
    //   io.emit("mic-dropped", { name });
    // setLiveSpeaker(null);
    (0, socketHandler_1.setIsSyncPauseMode)(true);
    for (const [socketId, user] of users.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        // console.logAction(
        //   "[Server] Sending config panel from handleWishToSpeak config:",
        //   JSON.stringify(config, null, 2)
        // );
        io.to(socketId).emit("receive:panelConfig", config);
    }
    evaluateSync();
}

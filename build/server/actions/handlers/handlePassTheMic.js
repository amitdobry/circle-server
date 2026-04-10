"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePassTheMic = handlePassTheMic;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
function handlePassTheMic(payload, context) {
    const { name } = payload;
    const { users, pointerMap, io, logSystem, logAction, evaluateSync } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleBreakSync payload.");
        return;
    }
    // ✅ Now update all states:
    for (const [socketId, user] of users.entries()) {
        if (user.name === name) {
            (0, socketHandler_1.clearPointer)("default-room", name);
            io.emit("update-pointing", { from: name, to: null });
            user.state = "isPassingTheMic";
        }
        else {
            (0, socketHandler_1.clearPointer)("default-room", user.name);
            io.emit("update-pointing", { from: user.name, to: null });
            user.state = "micPassInProcess";
        }
        users.set(socketId, user);
    }
    logAction(`👄 ${name} is going to pass the mic (breakSync)`);
    //   io.emit("mic-dropped", { name });
    // setLiveSpeaker(null);
    (0, socketHandler_1.setIsSyncPauseMode)(true);
    for (const [socketId, user] of users.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
    evaluateSync();
}

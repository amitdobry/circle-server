"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDeclineToSpeakAfterMicDropped = handleDeclineToSpeakAfterMicDropped;
const panelConfigService_1 = require("../../panelConfigService");
function handleDeclineToSpeakAfterMicDropped(payload, context) {
    const { name } = payload;
    const { users, pointerMap, io, log, evaluateSync } = context;
    if (!name) {
        log("🚨 Missing name in handleBreakSync payload.");
        return;
    }
    // ✅ Now update all states:
    for (const [socketId, user] of users.entries()) {
        pointerMap.set(user.name, user.name === name ? name : null);
        io.emit("update-pointing", {
            from: user.name,
            to: user.name === name ? name : null,
        });
        user.state =
            user.name === name
                ? "wantsToPickUpTheMic"
                : "appendingConcentToPickUpTheMic";
        users.set(socketId, user);
    }
    log(`✋ ${name} wishes to pick up the mic (post-drop)`);
    //   io.emit("mic-dropped", { name });
    for (const [socketId, user] of users.entries()) {
        const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
    }
    evaluateSync();
}

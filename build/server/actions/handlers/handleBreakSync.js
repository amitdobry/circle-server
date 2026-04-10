"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBreakSync = handleBreakSync;
const socketHandler_1 = require("../../socketHandler");
function handleBreakSync(payload, context) {
    const { name } = payload;
    const { pointerMap, io, logAction, logSystem } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleBreakSync payload.");
        return;
    }
    (0, socketHandler_1.setPointer)(name, name);
    io.emit("update-pointing", { from: name, to: name });
    logAction(`👄 ${name} requests the mic (breakSync)`);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleBreakSync = handleBreakSync;
function handleBreakSync(payload, context) {
    const { name } = payload;
    const { pointerMap, io, log, evaluateSync } = context;
    if (!name) {
        log("🚨 Missing name in handleBreakSync payload.");
        return;
    }
    pointerMap.set(name, name);
    io.emit("update-pointing", { from: name, to: name });
    log(`👄 ${name} requests the mic (breakSync)`);
    evaluateSync();
}

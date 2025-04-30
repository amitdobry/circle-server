"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePauseForThought = handlePauseForThought;
function handlePauseForThought(payload, context) {
    const { name, type, subType } = payload;
    const { gestureCatalog, io, log } = context;
    if (!name || !type || !subType) {
        log("🚨 Missing data in handlePauseForThought payload.");
        return;
    }
    const group = gestureCatalog[type];
    const gesture = group[subType];
    if (!gesture) {
        log(`🚫 Unknown gesture for pause: ${type}:${subType}`);
        return;
    }
    log(`🧠 ${name} requested silence: "${gesture.label}"`);
    io.emit("PauseForThought", {
        by: name,
        reasonCode: subType,
        ...gesture.getBroadcastPayload(name),
    });
    gesture.triggerEffect?.();
}

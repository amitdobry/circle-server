"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSyncedGesture = handleSyncedGesture;
function handleSyncedGesture(payload, context) {
    const { name, type, subType } = payload;
    const { gestureCatalog, logAction } = context;
    const group = gestureCatalog[type];
    const gesture = group[subType];
    if (!gesture)
        return;
    const label = gesture.label;
    const emoji = gesture.emoji;
    logAction(`🎧 ${emoji} ${name} says: "${label}"`);
    // context.io.emit("TextBoxUpdate", gesture.getBroadcastPayload(name));
    gesture.triggerEffect?.();
}

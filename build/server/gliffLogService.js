"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGliffLog = createGliffLog;
exports.clearGliffLog = clearGliffLog;
const gliffMemory = [];
const MAX_MEMORY_SIZE = 20;
function createGliffLog(entry, io) {
    const enriched = {
        ...entry,
        message: {
            ...entry.message,
            timestamp: Date.now(),
        },
    };
    const isText = enriched.message.messageType === "textInput";
    if (isText) {
        const last = gliffMemory[gliffMemory.length - 1];
        const canMerge = last &&
            last.userName === enriched.userName &&
            last.message.messageType === "textInput";
        const char = enriched.message.content;
        if (canMerge) {
            if (char === "__BACKSPACE__") {
                last.message.content = last.message.content.slice(0, -1);
            }
            else {
                last.message.content += char.slice(-1);
            }
            last.message.timestamp = enriched.message.timestamp;
        }
        else {
            if (char !== "__BACKSPACE__") {
                enriched.message.content = char.slice(-1);
                gliffMemory.push(enriched);
            }
        }
    }
    else {
        // Flush on gesture/action/context/etc
        gliffMemory.push(enriched);
    }
    // Trim memory
    while (gliffMemory.length > MAX_MEMORY_SIZE) {
        gliffMemory.shift();
    }
    console.log("🧾 gliffMemory snapshot:\n" + JSON.stringify(gliffMemory, null, 2));
    io.emit("gliffLog:update", gliffMemory);
    return enriched;
}
// Function to clear the gliff log (e.g., when session ends)
function clearGliffLog(io) {
    console.log("🧹 Clearing gliff log - session ended");
    gliffMemory.length = 0; // Clear the array
    io.emit("gliffLog:update", gliffMemory); // Notify all clients
}

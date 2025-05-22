"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSpeakerPanel = buildSpeakerPanel;
const speakerCatalog_1 = require("../ui-config/speakerCatalog");
function buildSpeakerPanel(ctx) {
    const currentUser = Array.from(ctx.allUsers.values()).find((u) => u.name === ctx.userName);
    const interrupter = Array.from(ctx.allUsers.values()).find((u) => u.state === "hasClickedMouth" || u.state === "hasClickedBrain");
    let stateId = "state-live";
    if (currentUser?.state === "hasDroppedTheMic") {
        stateId = "state-waiting-for-drop-the-mic";
    }
    else if (interrupter) {
        stateId = "state-waiting";
    }
    const panel = speakerCatalog_1.speakerCatalog[stateId];
    const config = panel.getConfig();
    if (stateId === "state-waiting" && interrupter) {
        const interrupterName = interrupter.name;
        config.forEach((block) => {
            block.blocks.forEach((b) => {
                if (b.id === "thinking-wait-text") {
                    b.content = `Please wait while ${interrupterName} is thinking...`;
                }
            });
        });
    }
    return config;
}

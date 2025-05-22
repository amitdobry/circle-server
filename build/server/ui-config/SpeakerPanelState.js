"use strict";
// server/ui-config/SpeakerPanelState.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeakerPanelState = void 0;
class SpeakerPanelState {
    constructor(key, label, panelConfig) {
        this.key = key;
        this.label = label;
        this.panelConfig = panelConfig;
    }
    getConfig() {
        return this.panelConfig;
    }
}
exports.SpeakerPanelState = SpeakerPanelState;

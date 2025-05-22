"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListenerPanelState = void 0;
class ListenerPanelState {
    constructor(key, label, panelConfig) {
        this.key = key;
        this.label = label;
        this.panelConfig = panelConfig;
    }
    getConfig() {
        return this.panelConfig;
    }
}
exports.ListenerPanelState = ListenerPanelState;

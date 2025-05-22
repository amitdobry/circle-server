"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listenerCatalog = void 0;
const listenerConfigs_1 = require("./listenerConfigs");
const ListenerPanelState_1 = require("./ListenerPanelState");
exports.listenerCatalog = {
    "state-1": new ListenerPanelState_1.ListenerPanelState("state-1", "Default (no group active)", listenerConfigs_1.testPanelListenerState1),
    "state-2": new ListenerPanelState_1.ListenerPanelState("state-2", "Ear group active", listenerConfigs_1.testPanelListenerState2),
    "state-3": new ListenerPanelState_1.ListenerPanelState("state-3", "Brain group active", listenerConfigs_1.testPanelListenerState3),
    "state-4": new ListenerPanelState_1.ListenerPanelState("state-4", "Mouth group active", listenerConfigs_1.testPanelListenerState4),
    "state-5": new ListenerPanelState_1.ListenerPanelState("state-5", "Passive waiting mode", listenerConfigs_1.testPanelListenerState5), // ✅
    "state-6": new ListenerPanelState_1.ListenerPanelState("state-6", "mic was dropped", listenerConfigs_1.testPanelListenerState6), // 🆕 Added here
    "state-7": new ListenerPanelState_1.ListenerPanelState("state-7", "Someone wants to pick up the mic", listenerConfigs_1.testPanelListenerState7), // 🆕 Added here
    "state-8": new ListenerPanelState_1.ListenerPanelState("state-8", "You’re asking to speak — waiting for group sync", listenerConfigs_1.testPanelListenerState8),
};

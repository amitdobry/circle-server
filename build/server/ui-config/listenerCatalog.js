"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listenerCatalog = void 0;
const listenerConfigs_1 = require("./listenerConfigs");
const ListenerPanelState_1 = require("./ListenerPanelState");
exports.listenerCatalog = {
    "state-1": new ListenerPanelState_1.ListenerPanelState("state-1", "Default (no group active)", listenerConfigs_1.testPanelListenerState1),
    "state-2": new ListenerPanelState_1.ListenerPanelState("state-2", "Ear group active — reflect reactions", listenerConfigs_1.testPanelListenerState2),
    "state-3": new ListenerPanelState_1.ListenerPanelState("state-3", "Brain group active — thought processing", listenerConfigs_1.testPanelListenerState3),
    "state-4": new ListenerPanelState_1.ListenerPanelState("state-4", "Mouth group active — interruption options", listenerConfigs_1.testPanelListenerState4),
    "state-5": new ListenerPanelState_1.ListenerPanelState("state-5", "Passive waiting — another listener is responding", listenerConfigs_1.testPanelListenerState5), // ✅
    "state-6": new ListenerPanelState_1.ListenerPanelState("state-6", "Mic was dropped — make a choice", listenerConfigs_1.testPanelListenerState6), // 🆕 Added here
    "state-7": new ListenerPanelState_1.ListenerPanelState("state-7", "Consent prompt — someone wants to speak", listenerConfigs_1.testPanelListenerState7), // 🆕 Added here
    "state-8": new ListenerPanelState_1.ListenerPanelState("state-8", "You’ve raised your hand — waiting for group consent", listenerConfigs_1.testPanelListenerState8),
    "state-9": new ListenerPanelState_1.ListenerPanelState("state-9", "You declined — staying off-mic for now", listenerConfigs_1.testPanelListenerState9),
    "state-10": new ListenerPanelState_1.ListenerPanelState("state-10", "You consented — waiting for group sync", listenerConfigs_1.testPanelListenerState10),
    "state-11": new ListenerPanelState_1.ListenerPanelState("panelPostSpeakerStateMicDropped", "Post-speaker — waiting for others after mic drop", listenerConfigs_1.testPanelListenerState11),
    "state-12": new ListenerPanelState_1.ListenerPanelState("panelListenerStateMicPassPending", "Speaker is preparing to pass the mic", listenerConfigs_1.testPanelListenerState12),
    "state-13": new ListenerPanelState_1.ListenerPanelState("panelSpeakerStateChooseSpecificUser", "Choose someone to pass the mic to", listenerConfigs_1.testPanelListenerState13),
    "state-14": new ListenerPanelState_1.ListenerPanelState("panelListenerMicOfferReceived", "You’ve been invited to speak — will you accept?", listenerConfigs_1.panelListenerMicOfferReceived),
    "state-15": new ListenerPanelState_1.ListenerPanelState("panelListenerMicOfferReceived", "Waiting for the invited user to accept the mic...", listenerConfigs_1.panelSpeakerWaitingForMicAcceptance),
    "state-16": new ListenerPanelState_1.ListenerPanelState("panelListenerMicOfferReceived", "Waiting for the invited user to accept the mic...", listenerConfigs_1.panelListenersWatchingMicOffer),
    "state-17": new ListenerPanelState_1.ListenerPanelState("state-17", "Waiting on picker of blue speaker", listenerConfigs_1.testPanelListenerState17),
    "state-18": new ListenerPanelState_1.ListenerPanelState("state-18", "Picking blue speaker", listenerConfigs_1.testPanelListenerState18),
    "state-19": new ListenerPanelState_1.ListenerPanelState("state-19", "Ear-blue picker — choose who to hear more from", listenerConfigs_1.panelEarBluePicker),
};

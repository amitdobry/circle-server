"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.speakerCatalog = void 0;
const SpeakerPanelState_1 = require("./SpeakerPanelState");
const speakerConfigs_1 = require("./speakerConfigs");
exports.speakerCatalog = {
    "state-live": new SpeakerPanelState_1.SpeakerPanelState("state-live", "Speaker is live", speakerConfigs_1.speakerPanelLive),
    "state-waiting": new SpeakerPanelState_1.SpeakerPanelState("state-waiting", "Speaker is waiting for listener to finish thinking", speakerConfigs_1.speakerPanelWaiting),
    "state-waiting-for-drop-the-mic": new SpeakerPanelState_1.SpeakerPanelState("state-waiting-for-drop-the-mic", "Speaker dropped the mic and is waiting", speakerConfigs_1.panelSpeakerStateMicDropped),
    "state-start-passing-mic": new SpeakerPanelState_1.SpeakerPanelState("state-start-passing-mic", "Speaker began process passing the mic", speakerConfigs_1.panelSpeakerStateStartPassingMic),
};

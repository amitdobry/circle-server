import {
  testPanelListenerState1,
  testPanelListenerState2,
  testPanelListenerState3,
  testPanelListenerState4,
  testPanelListenerState5,
  testPanelListenerState6,
  testPanelListenerState7,
  testPanelListenerState8,
  testPanelListenerState9,
  testPanelListenerState10,
  testPanelListenerState11,
  testPanelListenerState12,
  testPanelListenerState13,
  panelListenerMicOfferReceived,
  panelSpeakerWaitingForMicAcceptance,
  panelListenersWatchingMicOffer,
} from "./listenerConfigs";
import { ListenerPanelState } from "./ListenerPanelState";

export const listenerCatalog = {
  "state-1": new ListenerPanelState(
    "state-1",
    "Default (no group active)",
    testPanelListenerState1
  ),
  "state-2": new ListenerPanelState(
    "state-2",
    "Ear group active — reflect reactions",
    testPanelListenerState2
  ),
  "state-3": new ListenerPanelState(
    "state-3",
    "Brain group active — thought processing",
    testPanelListenerState3
  ),
  "state-4": new ListenerPanelState(
    "state-4",
    "Mouth group active — interruption options",
    testPanelListenerState4
  ),
  "state-5": new ListenerPanelState(
    "state-5",
    "Passive waiting — another listener is responding",
    testPanelListenerState5
  ), // ✅
  "state-6": new ListenerPanelState(
    "state-6",
    "Mic was dropped — make a choice",
    testPanelListenerState6
  ), // 🆕 Added here
  "state-7": new ListenerPanelState(
    "state-7",
    "Consent prompt — someone wants to speak",
    testPanelListenerState7
  ), // 🆕 Added here
  "state-8": new ListenerPanelState(
    "state-8",
    "You’ve raised your hand — waiting for group consent",
    testPanelListenerState8
  ),
  "state-9": new ListenerPanelState(
    "state-9",
    "You declined — staying off-mic for now",
    testPanelListenerState9
  ),
  "state-10": new ListenerPanelState(
    "state-10",
    "You consented — waiting for group sync",
    testPanelListenerState10
  ),
  "state-11": new ListenerPanelState(
    "panelPostSpeakerStateMicDropped",
    "Post-speaker — waiting for others after mic drop",
    testPanelListenerState11
  ),
  "state-12": new ListenerPanelState(
    "panelListenerStateMicPassPending",
    "Speaker is preparing to pass the mic",
    testPanelListenerState12
  ),
  "state-13": new ListenerPanelState(
    "panelSpeakerStateChooseSpecificUser",
    "Choose someone to pass the mic to",
    testPanelListenerState13
  ),
  "state-14": new ListenerPanelState(
    "panelListenerMicOfferReceived",
    "You’ve been invited to speak — will you accept?",
    panelListenerMicOfferReceived
  ),
  "state-15": new ListenerPanelState(
    "panelListenerMicOfferReceived",
    "Waiting for the invited user to accept the mic...",
    panelSpeakerWaitingForMicAcceptance
  ),
  "state-16": new ListenerPanelState(
    "panelListenerMicOfferReceived",
    "Waiting for the invited user to accept the mic...",
    panelListenersWatchingMicOffer
  ),
};

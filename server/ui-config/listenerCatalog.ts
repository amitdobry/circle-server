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
    "Ear group active",
    testPanelListenerState2
  ),
  "state-3": new ListenerPanelState(
    "state-3",
    "Brain group active",
    testPanelListenerState3
  ),
  "state-4": new ListenerPanelState(
    "state-4",
    "Mouth group active",
    testPanelListenerState4
  ),
  "state-5": new ListenerPanelState(
    "state-5",
    "Passive waiting mode",
    testPanelListenerState5
  ), // ✅
  "state-6": new ListenerPanelState(
    "state-6",
    "mic was dropped",
    testPanelListenerState6
  ), // 🆕 Added here
  "state-7": new ListenerPanelState(
    "state-7",
    "Someone wants to pick up the mic",
    testPanelListenerState7
  ), // 🆕 Added here
  "state-8": new ListenerPanelState(
    "state-8",
    "You’re asking to speak — waiting for group sync",
    testPanelListenerState8
  ),
  "state-9": new ListenerPanelState(
    "state-9",
    "You declined picking up the mic — waiting for group sync",
    testPanelListenerState9
  ),
  "state-10": new ListenerPanelState(
    "state-10",
    "You concent candidate to up the mic — waiting for group sync",
    testPanelListenerState10
  ),
};

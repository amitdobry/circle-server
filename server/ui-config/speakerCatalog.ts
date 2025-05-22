import { SpeakerPanelState } from "./SpeakerPanelState";
import {
  speakerPanelLive,
  speakerPanelWaiting,
  panelSpeakerStateMicDropped,
} from "./speakerConfigs";

export const speakerCatalog = {
  "state-live": new SpeakerPanelState(
    "state-live",
    "Speaker is live",
    speakerPanelLive
  ),
  "state-waiting": new SpeakerPanelState(
    "state-waiting",
    "Speaker is waiting for listener to finish thinking",
    speakerPanelWaiting
  ),
  "state-waiting-for-drop-the-mic": new SpeakerPanelState(
    "state-waiting-for-drop-the-mic",
    "Speaker dropped the mic and is waiting",
    panelSpeakerStateMicDropped
  ),
};

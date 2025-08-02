import { handleSyncedGesture } from "./handlers/handleSyncedGesture";
import { handleBreakSync } from "./handlers/handleBreakSync";
import { handlePauseForThought } from "./handlers/handlePauseForThought";
import { handlePointAtSpeaker } from "./handlers/handlePointAtSpeaker";
import { handleSelectMouth } from "./handlers/handleSelectMouth";
import { handleUnselectMouth } from "./handlers/handleUnSelectMouth";
import { ActionContext, ActionPayload } from "./routeAction";
import { handleSelectBrain } from "./handlers/handleSelectBrain";
import { handleSelectEar } from "./handlers/handleSelectEar";
import { handleUnSelectBrain } from "./handlers/handleUnSelectBrain";
import { handleDropTheMic } from "./handlers/handleDropTheMic";
import { handlePassTheMic } from "./handlers/handlePassTheMic";
import { handleWishToSpeakAfterMicDropped } from "./handlers/handleWishToSpeakAfterMicDropped";
import { handleDeclineToSpeakAfterMicDropped } from "./handlers/handleDeclineToSpeakAfterMicDropped";
import { handleConcentNewSpeakerFromMicDropped } from "./handlers/handleConcentNewSpeakerFromMicDroppedState";
import { handleDeclineNewCandidateRequestAfterMicDropped } from "./handlers/handleDeclineNewCandidateRequestAfterMicDropped";
import { handleOpenChooseASpeakerFromPassTheMic } from "./handlers/handleOpenChooseASpeakerFromPassTheMic";
import { handleOfferMicToUserFromPassTheMic } from "./handlers/handleOfferMicToUserFromPassTheMic";
import { handleAcceptMicOfferFromPassTheMic } from "./handlers/handleAcceptMicOfferFromPassTheMic";
import { handleUnSelectEar } from "./handlers/handleUnSelectEar";

export const handlersMap: Record<
  string,
  (payload: ActionPayload, context: ActionContext) => void
> = {
  handleSyncedGesture,
  handleBreakSync,
  handlePauseForThought,
  handlePointAtSpeaker,
  handleSelectMouth,
  handleUnselectMouth,
  handleSelectBrain,
  handleUnSelectBrain,
  handleSelectEar,
  handleUnSelectEar,
  handleDropTheMic,
  handlePassTheMic,
  handleWishToSpeakAfterMicDropped,
  handleDeclineToSpeakAfterMicDropped,
  handleConcentNewSpeakerFromMicDropped,
  handleDeclineNewCandidateRequestAfterMicDropped,
  handleOpenChooseASpeakerFromPassTheMic,
  handleOfferMicToUserFromPassTheMic,
  handleAcceptMicOfferFromPassTheMic,
};

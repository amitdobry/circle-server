import { handleSyncedGesture } from "./handlers/handleSyncedGesture";
import { handleBreakSync } from "./handlers/handleBreakSync";
import { handlePauseForThought } from "./handlers/handlePauseForThought";
import { handlePointAtSpeaker } from "./handlers/handlePointAtSpeaker";
import { handleSelectMouth } from "./handlers/handleSelectMouth";
import { handleUnselectMouth } from "./handlers/handleUnSelectMouth";
import { ActionContext, ActionPayload } from "./routeAction";
import { handleSelectBrain } from "./handlers/handleSelectBrain";
import { handleUnSelectBrain } from "./handlers/handleUnSelectBrain";
import { handleDropTheMic } from "./handlers/handleDropTheMic";
import { handleWishToSpeakAfterMicDropped } from "./handlers/handleWishToSpeakAfterMicDropped";
import { handleDeclineToSpeakAfterMicDropped } from "./handlers/handleDeclineToSpeakAfterMicDropped.ts";

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
  handleDropTheMic,
  handleWishToSpeakAfterMicDropped,
  handleDeclineToSpeakAfterMicDropped,
};

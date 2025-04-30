import { handleSyncedGesture } from "./handlers/handleSyncedGesture";
import { handleBreakSync } from "./handlers/handleBreakSync";
import { handlePauseForThought } from "./handlers/handlePauseForThought";
import { handlePointAtSpeaker } from "./handlers/handlePointAtSpeaker";
import { ActionContext, ActionPayload } from "./routeAction";

export const handlersMap: Record<
  string,
  (payload: ActionPayload, context: ActionContext) => void
> = {
  handleSyncedGesture,
  handleBreakSync,
  handlePauseForThought,
  handlePointAtSpeaker,
};

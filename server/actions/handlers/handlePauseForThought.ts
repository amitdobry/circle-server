import { Gesture } from "../../ui-config/Gestures";
import { ActionPayload, ActionContext } from "../routeAction";

export function handlePauseForThought(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name, type, subType } = payload;
  const { gestureCatalog, io, log } = context;

  if (!name || !type || !subType) {
    log("🚨 Missing data in handlePauseForThought payload.");
    return;
  }

  const group = gestureCatalog[type as keyof typeof gestureCatalog] as Record<
    string,
    Gesture
  >;
  const gesture = group[subType];

  if (!gesture) {
    log(`🚫 Unknown gesture for pause: ${type}:${subType}`);
    return;
  }

  log(`🧠 ${name} requested silence: "${gesture.label}"`);

  io.emit("PauseForThought", {
    by: name,
    reasonCode: subType,
    ...gesture.getBroadcastPayload(name),
  });

  gesture.triggerEffect?.();
}

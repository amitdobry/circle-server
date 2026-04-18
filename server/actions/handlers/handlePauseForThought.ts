import { Gesture } from "../../ui-config/Gestures";
import { ActionPayload, ActionContext } from "../routeAction";

export function handlePauseForThought(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name, type, subType } = payload;
  const { gestureCatalog, io, logAction, logSystem, roomId } = context;

  if (!name || !type || !subType) {
    logSystem("🚨 Missing data in handlePauseForThought payload.");
    return;
  }

  const group = gestureCatalog[type as keyof typeof gestureCatalog] as Record<
    string,
    Gesture
  >;
  const gesture = group[subType];

  if (!gesture) {
    logSystem(`🚫 Unknown gesture for pause: ${type}:${subType}`);
    return;
  }

  logAction(`🧠 ${name} requested silence: "${gesture.label}"`);

  // TODO Phase E: Room-scope this broadcast
  io.emit("PauseForThought", {
    by: name,
    reasonCode: subType,
    ...gesture.getBroadcastPayload(name),
  });

  gesture.triggerEffect?.(io, name, roomId); // Pass roomId for room-scoped gliff
}

import { Gesture } from "../../ui-config/Gestures";
import { ActionPayload, ActionContext } from "../routeAction";

export function handleSyncedGesture(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name, type, subType } = payload;
  const { io, gestureCatalog, logAction, roomId } = context;

  const group = gestureCatalog[type as keyof typeof gestureCatalog] as Record<
    string,
    Gesture
  >;
  const gesture = group[subType!];

  if (!gesture) return;

  const label = gesture.label;
  const emoji = gesture.emoji;

  logAction(`🎧 ${emoji} ${name} says: "${label}"`);
  // context.io.emit("TextBoxUpdate", gesture.getBroadcastPayload(name));
  gesture.triggerEffect?.(io, name, roomId);
}

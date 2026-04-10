import { ActionPayload, ActionContext } from "../routeAction";
import { emojiLookup } from "../../avatarManager"; // adjust path if needed
import { setPointer } from "../../socketHandler";

export function handlePointAtSpeaker(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { from, to } = payload;
  const { pointerMap, users, io, logAction, logSystem, evaluateSync } = context;

  if (!from || !to) {
    logSystem("🚨 Missing 'from' or 'to' in pointAtSpeaker payload.");
    return;
  }

  setPointer("default-room", from, to);
  io.emit("update-pointing", { from, to });

  const avatarId =
    Array.from(users.values()).find((u) => u.name === from)?.avatarId || "";
  const emoji = emojiLookup[avatarId] || "";

  if (from === to) {
    logAction(`✋ ${emoji} ${from} wishes to speak`);
  } else {
    logAction(`🔁 ${emoji} ${from} ➡️ ${to}`);
  }

  evaluateSync();
}

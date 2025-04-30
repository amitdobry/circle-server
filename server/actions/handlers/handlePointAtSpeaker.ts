import { ActionPayload, ActionContext } from "../routeAction";
import { emojiLookup } from "../../avatarManager"; // adjust path if needed

export function handlePointAtSpeaker(
  payload: ActionPayload,
  context: ActionContext
) {
  const { from, to } = payload;
  const { pointerMap, users, io, log, evaluateSync } = context;

  if (!from || !to) {
    log("🚨 Missing 'from' or 'to' in pointAtSpeaker payload.");
    return;
  }

  pointerMap.set(from, to);
  io.emit("update-pointing", { from, to });

  const avatarId =
    Array.from(users.values()).find((u) => u.name === from)?.avatarId || "";
  const emoji = emojiLookup[avatarId] || "";

  if (from === to) {
    log(`✋ ${emoji} ${from} wishes to speak`);
  } else {
    log(`🔁 ${emoji} ${from} ➡️ ${to}`);
  }

  evaluateSync();
}

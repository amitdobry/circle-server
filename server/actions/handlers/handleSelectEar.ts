import { ActionPayload, ActionContext, filterUsersByRoom } from "../routeAction";
import { emojiLookup } from "../../avatarManager"; // adjust path if needed
import { getPanelConfigFor } from "../../panelConfigService";

export function handleSelectEar(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name: earClickerName } = payload;
  const { users, io, logSystem, logAction, roomId } = context;

  if (!earClickerName) {
    logSystem("🚨 Missing 'name' in selectEar payload.");
    return;
  }

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  const avatarId =
    Array.from(roomUsers.values()).find((u) => u.name === earClickerName)
      ?.avatarId ?? "";
  const emoji = emojiLookup[avatarId] || "";

  logAction(` ${emoji} ${earClickerName} clicked ear — he might relate`);

  // Phase E: Now update states (in this room):
  for (const [socketId, user] of roomUsers.entries()) {
    if (user.name === earClickerName && user.state !== "hasClickedEar") {
      user.state = "hasClickedEar";
      users.set(socketId, user);
    }
  }

  // Emit updated config only to the user who clicked ear
  const userEntry = Array.from(roomUsers.entries()).find(
    ([, user]) => user.name === earClickerName
  );
  if (userEntry) {
    const [socketId, user] = userEntry;
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

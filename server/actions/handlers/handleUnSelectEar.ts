import { ActionContext, ActionPayload, filterUsersByRoom } from "../routeAction";
import { getPanelConfigFor } from "../../panelConfigService";

export function handleUnSelectEar(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, io, logSystem, logAction, roomId } = context;

  if (!name) {
    logSystem("🚨 Missing name in unselectEar payload");
    return;
  }

  logAction(`👂❌ ${name} stopped Reflecting`);

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  // 🔁 Only reset the user's own state back to "regular"
  for (const [socketId, user] of roomUsers.entries()) {
    if (user.name === name) {
      user.state = "regular";
      users.set(socketId, user);
      break; // one match is enough
    }
  }

  // Emit updated config only to the user who unselected
  const userEntry = Array.from(roomUsers.entries()).find(
    ([, user]) => user.name === name
  );
  if (userEntry) {
    const [socketId, user] = userEntry;
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

import { getPanelConfigFor } from "../../panelConfigService";
import { setIsSyncPauseMode, setLiveSpeaker, clearPointer } from "../../socketHandler";
import { ActionPayload, ActionContext, filterUsersByRoom } from "../routeAction";

export function handleDisagree(payload: ActionPayload, context: ActionContext) {
  const { name } = payload;
  const { users, pointerMap, io, logAction, logSystem, roomId } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleDisagree payload.");
    return;
  }

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  for (const [socketId, user] of roomUsers.entries()) {
    // Phase E: Reset pointing for users in this room
    clearPointer(name, roomId);
    io.to(roomId).emit("update-pointing", { from: name, to: null });
    user.state = "regular";
    users.set(socketId, user);
  }

  // 🔍 Go back to attention selector mode (like declining mic offer)
  setIsSyncPauseMode(false);
  setLiveSpeaker(null, roomId);

  logAction(`❌ ${name} disagreed - going back to attention selector`);

  // Phase E: Reset users in this room to regular state and emit new panels
  for (const [socketId, user] of roomUsers.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

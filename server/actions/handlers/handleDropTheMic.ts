import { getPanelConfigFor } from "../../panelConfigService";
import {
  setIsSyncPauseMode,
  setLiveSpeaker,
  clearPointer,
} from "../../socketHandler";
import { ActionPayload, ActionContext, filterUsersByRoom } from "../routeAction";

export function handleDropTheMic(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name } = payload;
  const { users, pointerMap, io, logAction, logSystem, roomId } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  // Phase E: Now update states (in this room):
  for (const [socketId, user] of roomUsers.entries()) {
    if (user.name === name) {
      clearPointer(name, roomId);
      io.to(roomId).emit("update-pointing", { from: name, to: null });
      user.state = "hasDroppedTheMic";
    } else {
      clearPointer(user.name, roomId);
      io.to(roomId).emit("update-pointing", { from: user.name, to: null });
      user.state = "micIsDropped";
    }
    users.set(socketId, user);
  }

  logAction(`👄 ${name} dropped the mic (breakSync)`);
  setLiveSpeaker(null, roomId);
  setIsSyncPauseMode(true, roomId);

  for (const [socketId, user] of roomUsers.entries()) {
    const config = getPanelConfigFor(user.name);
    // console.logAction(
    //   "[Server] Sending config panel from handleWishToSpeak config:",
    //   JSON.stringify(config, null, 2)
    // );
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

import { getPanelConfigFor } from "../../panelConfigService";
import {
  setIsSyncPauseMode,
  setLiveSpeaker,
  setPointer,
  clearPointer,
} from "../../socketHandler";
import {
  ActionPayload,
  ActionContext,
  filterUsersByRoom,
} from "../routeAction";

export function handlePassTheMic(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name } = payload;
  const { users, pointerMap, io, logSystem, logAction, roomId } = context;

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
      user.state = "isPassingTheMic";
    } else {
      clearPointer(user.name, roomId);
      io.to(roomId).emit("update-pointing", { from: user.name, to: null });
      user.state = "micPassInProcess";
    }
    users.set(socketId, user);
  }

  logAction(`👄 ${name} is passing the mic (entering handoff)`);
  // Don't clear liveSpeaker - they're still speaker during handoff
  setIsSyncPauseMode(true, roomId);

  for (const [socketId, user] of roomUsers.entries()) {
    const config = getPanelConfigFor(user.name, roomId);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

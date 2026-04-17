import { getPanelConfigFor } from "../../panelConfigService";
import {
  setIsSyncPauseMode,
  setLiveSpeaker,
  setPointer,
  clearPointer,
} from "../../socketHandler";
import { ActionPayload, ActionContext } from "../routeAction";

export function handlePassTheMic(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name } = payload;
  const { users, pointerMap, io, logSystem, logAction } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  // ✅ Now update all states:
  for (const [socketId, user] of users.entries()) {
    if (user.name === name) {
      clearPointer(name);
      io.emit("update-pointing", { from: name, to: null });
      user.state = "isPassingTheMic";
    } else {
      clearPointer(user.name);
      io.emit("update-pointing", { from: user.name, to: null });
      user.state = "micPassInProcess";
    }
    users.set(socketId, user);
  }

  logAction(`👄 ${name} is going to pass the mic (breakSync)`);
  setLiveSpeaker(null);
  setIsSyncPauseMode(true);

  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

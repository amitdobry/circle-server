import { getPanelConfigFor } from "../../panelConfigService";
import {
  setIsSyncPauseMode,
  setLiveSpeaker,
  clearPointer,
} from "../../socketHandler";
import { ActionPayload, ActionContext } from "../routeAction";

export function handleDropTheMic(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name } = payload;
  const { users, pointerMap, io, logAction, logSystem, evaluateSync } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  // ✅ Now update all states:
  for (const [socketId, user] of users.entries()) {
    if (user.name === name) {
      clearPointer("default-room", name);
      io.emit("update-pointing", { from: name, to: null });
      user.state = "hasDroppedTheMic";
    } else {
      clearPointer("default-room", user.name);
      io.emit("update-pointing", { from: user.name, to: null });
      user.state = "micIsDropped";
    }
    users.set(socketId, user);
  }

  logAction(`👄 ${name} dropped the mic (breakSync)`);
  //   io.emit("mic-dropped", { name });
  // setLiveSpeaker(null);
  setIsSyncPauseMode(true);

  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    // console.logAction(
    //   "[Server] Sending config panel from handleWishToSpeak config:",
    //   JSON.stringify(config, null, 2)
    // );
    io.to(socketId).emit("receive:panelConfig", config);
  }

  evaluateSync();
}

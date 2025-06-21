import { getPanelConfigFor } from "../../panelConfigService";
import { setIsSyncPauseMode, setLiveSpeaker } from "../../socketHandler";
import { ActionPayload, ActionContext } from "../routeAction";

export function handlePassTheMic(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, pointerMap, io, logSystem, logAction, evaluateSync } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  // ✅ Now update all states:
  for (const [socketId, user] of users.entries()) {
    if (user.name === name) {
      pointerMap.set(name, null);
      io.emit("update-pointing", { from: name, to: null });
      user.state = "isPassingTheMic";
    } else {
      pointerMap.set(user.name, null);
      io.emit("update-pointing", { from: user.name, to: null });
      user.state = "micPassInProcess";
    }
    users.set(socketId, user);
  }

  logAction(`👄 ${name} is going to pass the mic (breakSync)`);
  //   io.emit("mic-dropped", { name });
  // setLiveSpeaker(null);
  setIsSyncPauseMode(true);

  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }

  evaluateSync();
}

import { getPanelConfigFor } from "../../panelConfigService";
import { setIsSyncPauseMode, setLiveSpeaker, clearPointer } from "../../socketHandler";
import { ActionPayload, ActionContext } from "../routeAction";

export function handleDisagree(payload: ActionPayload, context: ActionContext) {
  const { name } = payload;
  const { users, pointerMap, io, logAction, logSystem } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleDisagree payload.");
    return;
  }

  for (const [socketId, user] of users.entries()) {
    // 🔄 Reset pointing for the disagreeing user and all other users
    clearPointer(name);
    io.emit("update-pointing", { from: name, to: null });
    user.state = "regular";
    users.set(socketId, user);
  }

  // 🔍 Go back to attention selector mode (like declining mic offer)
  setIsSyncPauseMode(false);
  setLiveSpeaker(null);

  logAction(`❌ ${name} disagreed - going back to attention selector`);

  // 🔄 Reset all users to regular state and emit new panels
  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

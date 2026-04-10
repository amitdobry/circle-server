import { ActionContext, ActionPayload } from "../routeAction";
import { getPanelConfigFor } from "../../panelConfigService";
import { getLiveSpeaker } from "../../socketHandler";

export function handleUnselectMouth(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, io, logSystem, logAction } = context;

  if (!name) {
    logSystem("🚨 Missing name in unselect payload");
    return;
  }

  logAction(`↩️ ${name} unselected mouth gesture`);

  // Reset all listeners to "regular"
  for (const [socketId, user] of users.entries()) {
    if (user.name === name || user.state === "waiting") {
      user.state = "regular";
      users.set(socketId, user);
    }
  }

  // 🔁 Reset speaker's `interruptedBy` field
  const liveSpeakerName = getLiveSpeaker();
  const speakerEntry = liveSpeakerName
    ? Array.from(users.entries()).find(([, user]) => user.name === liveSpeakerName)
    : undefined;
  if (speakerEntry) {
    const [socketId, speakerUser] = speakerEntry;
    speakerUser.interruptedBy = "";
    users.set(socketId, speakerUser);
  }

  // Emit updated config to all
  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

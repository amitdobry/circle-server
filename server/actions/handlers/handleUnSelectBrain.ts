import { ActionContext, ActionPayload } from "../routeAction";
import { getPanelConfigFor } from "../../panelConfigService";

export function handleUnSelectBrain(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, io, log } = context;

  if (!name) {
    log("🚨 Missing name in unselect payload");
    return;
  }

  log(`↩️ ${name} unselected Brain gesture`);

  // Reset all listeners to "regular"
  for (const [socketId, user] of users.entries()) {
    if (user.name === name || user.state === "waiting") {
      user.state = "regular";
      users.set(socketId, user);
    }
  }

  // 🔁 Reset speaker's `interruptedBy` field
  const speakerEntry = Array.from(users.entries()).find(
    ([, user]) => user.state === "speaking"
  );
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

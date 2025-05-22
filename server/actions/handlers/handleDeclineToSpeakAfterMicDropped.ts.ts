import { getPanelConfigFor } from "../../panelConfigService";
import { ActionPayload, ActionContext } from "../routeAction";

export function handleDeclineToSpeakAfterMicDropped(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, pointerMap, io, log, evaluateSync } = context;

  if (!name) {
    log("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  // ✅ Now update all states:
  for (const [socketId, user] of users.entries()) {
    pointerMap.set(user.name, user.name === name ? name : null);
    io.emit("update-pointing", {
      from: user.name,
      to: user.name === name ? name : null,
    });
    user.state =
      user.name === name
        ? "wantsToPickUpTheMic"
        : "appendingConcentToPickUpTheMic";
    users.set(socketId, user);
  }

  log(`✋ ${name} wishes to pick up the mic (post-drop)`);

  //   io.emit("mic-dropped", { name });

  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }

  evaluateSync();
}

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

  for (const [socketId, user] of users.entries()) {
    if (user.name === name) {
      pointerMap.set(user.name, null);
      io.emit("update-pointing", { from: user.name, to: null });
      user.state = "doesNotWantToPickUpTheMic";
    } else {
      // pointerMap.set(user.name, null);
      // io.emit("update-pointing", { from: user.name, to: null });
      // user.state = "regular"; // optional
    }
    users.set(socketId, user);
  }

  log(`✋ ${name} does not whish to pick up the mic (post-drop)`);

  //   io.emit("mic-dropped", { name });

  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }

  evaluateSync();
}

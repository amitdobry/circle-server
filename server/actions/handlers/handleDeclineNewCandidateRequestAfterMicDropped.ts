import { getPanelConfigFor } from "../../panelConfigService";
import { setIsSyncPauseMode } from "../../socketHandler";
import { ActionPayload, ActionContext } from "../routeAction";

export function handleDeclineNewCandidateRequestAfterMicDropped(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, pointerMap, io, log, evaluateSync } = context;

  if (!name) {
    log("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  let MicPickerProspect = "";

  for (const [socketId, user] of users.entries()) {
    if (user.name === name) {
      pointerMap.set(user.name, null);
      io.emit("update-pointing", { from: user.name, to: null });
    }
    if (user.state === "wantsToPickUpTheMic") {
      MicPickerProspect = user.name;
    }
    users.set(socketId, user);
  }

  log(
    `✋ ${name} declined ${MicPickerProspect} to pick up the mic, shifting back to attention selector`
  );

  // 🔍 Check if ALL listeners declined
  setIsSyncPauseMode(false);

  // Optional: reset state and emit new panels
  for (const [socketId, user] of users.entries()) {
    user.state = "regular";
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }

  evaluateSync(); // clear any previous sync
  return;
}

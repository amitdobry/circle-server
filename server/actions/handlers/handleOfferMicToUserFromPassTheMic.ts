import { getPanelConfigFor } from "../../panelConfigService";
import { setIsSyncPauseMode, setLiveSpeaker } from "../../socketHandler";
import { ActionPayload, ActionContext } from "../routeAction";

export function handleOfferMicToUserFromPassTheMic(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name, targetUser } = payload;
  const { users, pointerMap, io, log, evaluateSync } = context;

  if (!name || !targetUser) {
    log("🚨 Missing name or targetUser in mic pass handler");
    return;
  }

  log(`🎤 ${name} offered the mic to ${targetUser}`);

  // Then use users map to update states accordingly
  for (const [socketId, user] of users.entries()) {
    if (user.name === name) {
      user.state = "hasOfferedMicToUserFromPassTheMic";
    } else if (user.name === targetUser) {
      user.state = "micOfferReceivedFromPassTheMic";
    } else {
      user.state = "awaitingUserMicOfferResolutionFromPassTheMic";
    }

    users.set(socketId, user);
  }

  // 👆 Set pointer and update state
  pointerMap.set(name, targetUser);
  io.emit("update-pointing", { from: name, to: targetUser });

  setIsSyncPauseMode(true);

  // Emit updates
  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }

  evaluateSync();
}

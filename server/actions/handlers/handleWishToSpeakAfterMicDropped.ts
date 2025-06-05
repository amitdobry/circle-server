import { getPanelConfigFor } from "../../panelConfigService";
// import { setIsSyncPauseMode, setLiveSpeaker } from "../../socketHandler";
import { ActionPayload, ActionContext } from "../routeAction";

export function handleWishToSpeakAfterMicDropped(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, pointerMap, io, log, evaluateSync } = context;

  if (!name) {
    log("🚨 Missing name in handleBreakSync payload.");
    return;
  }
  // ✅ 1. Set pointing and assign states
  for (const [socketId, user] of users.entries()) {
    const isCandidate = user.name === name;

    pointerMap.set(user.name, isCandidate ? name : null);
    io.emit("update-pointing", {
      from: user.name,
      to: isCandidate ? name : null,
    });

    user.state = isCandidate
      ? "wantsToPickUpTheMic"
      : "appendingConcentToPickUpTheMic";

    users.set(socketId, user);
  }

  log(`✋ ${name} wishes to pick up the mic (post-drop)`);

  // setIsSyncPauseMode(true);

  // ✅ 2. Refresh UI for all users
  for (const [socketId, user] of users.entries()) {
    log(`📦 Preparing panel for ${user.name} → ${user.state}`);
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }

  // ✅ 3. Re-evaluate sync state
  evaluateSync();
}

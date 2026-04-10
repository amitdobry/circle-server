import { getPanelConfigFor } from "../../panelConfigService";
import { setPointer, clearPointer } from "../../socketHandler";
import { ActionPayload, ActionContext } from "../routeAction";

export function handleWishToSpeakAfterMicDropped(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, io, logSystem, logAction, evaluateSync } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleBreakSync payload.");
    return;
  }
  // ✅ 1. Set pointing and assign states
  for (const [socketId, user] of users.entries()) {
    const isCandidate = user.name === name;

    // Use setPointer/clearPointer so SpeakerManager stays in sync
    if (isCandidate) {
      setPointer(user.name, name);
    } else {
      clearPointer(user.name);
    }
    io.emit("update-pointing", {
      from: user.name,
      to: isCandidate ? name : null,
    });

    user.state = isCandidate
      ? "wantsToPickUpTheMic"
      : "appendingConcentToPickUpTheMic";

    users.set(socketId, user);
  }

  logAction(`✋ ${name} wishes to pick up the mic (post-drop)`);

  // setIsSyncPauseMode(true);

  // ✅ 2. Refresh UI for all users
  for (const [socketId, user] of users.entries()) {
    logSystem(`📦 Preparing panel for ${user.name} → ${user.state}`);
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }

  // ✅ 3. Re-evaluate sync state
  evaluateSync();
}

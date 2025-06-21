import { getPanelConfigFor } from "../../panelConfigService";
import { setIsSyncPauseMode } from "../../socketHandler";
import { ActionPayload, ActionContext } from "../routeAction";

export function handleDeclineToSpeakAfterMicDropped(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, pointerMap, io, logSystem, logAction, evaluateSync } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  let declinedCount = 1;
  let totalEligibleUsers = 0;

  for (const [socketId, user] of users.entries()) {
    if (user.name === name) {
      pointerMap.set(user.name, null);
      io.emit("update-pointing", { from: user.name, to: null });
      user.state = "doesNotWantToPickUpTheMic";
    }
    // Count total listeners (exclude whoever dropped the mic)
    if (user.state !== "speaking") {
      totalEligibleUsers++;
      if (user.state === "doesNotWantToPickUpTheMic") {
        declinedCount++;
      }
    }

    users.set(socketId, user);
  }

  logAction(`✋ ${name} does not whish to pick up the mic (post-drop)`);

  // 🔍 Check if ALL listeners declined
  if (declinedCount === totalEligibleUsers && totalEligibleUsers > 0) {
    logAction(
      `📢 No one stepped up to take the mic — returning to attention phase`
    );
    setIsSyncPauseMode(false);

    // Optional: reset state and emit new panels
    for (const [socketId, user] of users.entries()) {
      user.state = "regular";
      pointerMap.set(user.name, null);
      const config = getPanelConfigFor(user.name);
      io.to(socketId).emit("receive:panelConfig", config);
    }

    evaluateSync(); // clear any previous sync
    return;
  }

  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }

  evaluateSync();
}

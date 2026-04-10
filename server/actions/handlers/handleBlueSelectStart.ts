// handlers/handleBlueSelectStart.ts
import { ActionContext, ActionPayload } from "../routeAction";
import { setIsSyncPauseMode, clearPointer } from "../../socketHandler";
import { getPanelConfigFor } from "../../panelConfigService";

export function handleBlueSelectStart(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name, flavor } = payload;
  const { users, pointerMap, io, logAction, logSystem, evaluateSync } = context;

  if (!name) {
    logSystem("🟦 handleBlueSelectStart: missing name in payload");
    return;
  }

  if (!flavor) {
    logSystem("🟦 handleBlueSelectStart: missing flavor in payload");
    return;
  }

  const speaker = Array.from(users.values()).find(
    (u) => u.state === "speaking",
  );
  if (!speaker) {
    logSystem(`🟦 handleBlueSelectStart: no current speaker in session 123`);
    return;
  }

  clearPointer(name);
  io.emit("update-pointing", { from: name, to: null });

  // ✅ Now update all states:
  for (const [socketId, user] of users.entries()) {
    if (user.name === name) {
      user.state = "isPickingBlueSpeaker";
    } else if (user.state === "speaking") {
      user.state = "postSpeakerWaitingOnBlue";
    } else {
      user.state = "waitingOnPickerOfBlueSpeaker";
    }
    users.set(socketId, user);
  }

  logAction(`👄 ${name} dropped the mic (breakSync)`);

  setIsSyncPauseMode(true);

  logAction(`🟦 ${name} started Blue select${flavor ? ` (${flavor})` : ""}`);

  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

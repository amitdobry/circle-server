// handlers/handleBlueSelectStart.ts
import { ActionContext, ActionPayload, filterUsersByRoom } from "../routeAction";
import { setIsSyncPauseMode, clearPointer, getLiveSpeaker } from "../../socketHandler";
import { getPanelConfigFor } from "../../panelConfigService";

export function handleBlueSelectStart(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name, flavor } = payload;
  const { users, pointerMap, io, logAction, logSystem, roomId } = context;

  if (!name) {
    logSystem("🟦 handleBlueSelectStart: missing name in payload");
    return;
  }

  if (!flavor) {
    logSystem("🟦 handleBlueSelectStart: missing flavor in payload");
    return;
  }

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  const liveSpeakerName = getLiveSpeaker(roomId);
  const speaker = liveSpeakerName
    ? Array.from(roomUsers.values()).find((u) => u.name === liveSpeakerName)
    : null;
  if (!speaker) {
    logSystem(`🟦 handleBlueSelectStart: no current speaker in room`);
    return;
  }

  clearPointer(name, roomId);
  io.to(roomId).emit("update-pointing", { from: name, to: null });

  // Phase E: Now update states (in this room):
  for (const [socketId, user] of roomUsers.entries()) {
    if (user.name === name) {
      user.state = "isPickingBlueSpeaker";
    } else if (user.name === speaker.name) {
      user.state = "postSpeakerWaitingOnBlue";
    } else {
      user.state = "waitingOnPickerOfBlueSpeaker";
    }
    users.set(socketId, user);
  }

  logAction(`👄 ${name} dropped the mic (breakSync)`);

  setIsSyncPauseMode(true);

  logAction(`🟦 ${name} started Blue select${flavor ? ` (${flavor})` : ""}`);

  for (const [socketId, user] of roomUsers.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

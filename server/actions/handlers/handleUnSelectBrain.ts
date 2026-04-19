import { ActionContext, ActionPayload, filterUsersByRoom } from "../routeAction";
import { getPanelConfigFor } from "../../panelConfigService";
import { getLiveSpeaker } from "../../socketHandler";

export function handleUnSelectBrain(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, io, logSystem, logAction, roomId } = context;

  if (!name) {
    logSystem("🚨 Missing name in unselect payload");
    return;
  }

  logAction(`↩️ ${name} unselected Brain gesture`);

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  // Reset all listeners to "regular"
  for (const [socketId, user] of roomUsers.entries()) {
    if (user.name === name || user.state === "waiting") {
      user.state = "regular";
      users.set(socketId, user);
    }
  }

  // Phase E: Reset speaker's `interruptedBy` field (in this room)
  const liveSpeakerName = getLiveSpeaker(roomId);
  const speakerEntry = liveSpeakerName
    ? Array.from(roomUsers.entries()).find(([, user]) => user.name === liveSpeakerName)
    : undefined;
  if (speakerEntry) {
    const [socketId, speakerUser] = speakerEntry;
    speakerUser.interruptedBy = "";
    users.set(socketId, speakerUser);
  }

  // Phase E: Emit updated config to users in this room only
  for (const [socketId, user] of roomUsers.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

import { getPanelConfigFor } from "../../panelConfigService";
import { setIsSyncPauseMode, setLiveSpeaker, clearPointer } from "../../socketHandler";
import { ActionPayload, ActionContext, filterUsersByRoom } from "../routeAction";

export function handleDeclineNewCandidateRequestAfterMicDropped(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name } = payload;
  const { users, pointerMap, io, logAction, logSystem, roomId } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  let MicPickerProspect = "";

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  for (const [socketId, user] of roomUsers.entries()) {
    if (user.name === name) {
      clearPointer(user.name, roomId);
      io.to(roomId).emit("update-pointing", { from: user.name, to: null });
    }
    if (user.state === "wantsToPickUpTheMic") {
      MicPickerProspect = user.name;
    }
    users.set(socketId, user);
  }

  logAction(
    `✋ ${name} declined ${MicPickerProspect} to pick up the mic, shifting back to attention selector`,
  );

  // Clear all pointers and live speaker so V2 pointerMap is clean
  // for the next attention-selection round
  for (const [, user] of roomUsers.entries()) {
    clearPointer(user.name, roomId);
    io.to(roomId).emit("update-pointing", { from: user.name, to: null });
  }

  setLiveSpeaker(null, roomId);
  setIsSyncPauseMode(false);

  // Phase E: Optional: reset state and emit new panels (in this room)
  for (const [socketId, user] of roomUsers.entries()) {
    user.state = "regular";
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
  return;
}

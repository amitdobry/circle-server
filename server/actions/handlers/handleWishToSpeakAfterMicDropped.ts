import { getPanelConfigFor } from "../../panelConfigService";
import { setPointer, clearPointer } from "../../socketHandler";
import { ActionPayload, ActionContext, filterUsersByRoom } from "../routeAction";

export function handleWishToSpeakAfterMicDropped(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, io, logSystem, logAction, roomId } = context;

  if (!name) {
    logSystem("🚨 Missing name in handleBreakSync payload.");
    return;
  }

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  // ✅ 1. Set pointing and assign states
  for (const [socketId, user] of roomUsers.entries()) {
    const isCandidate = user.name === name;

    // Use setPointer/clearPointer so SpeakerManager stays in sync
    if (isCandidate) {
      setPointer(user.name, name, roomId);
    } else {
      clearPointer(user.name, roomId);
    }
    io.to(roomId).emit("update-pointing", {
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

  // Phase E: 2. Refresh UI for users in this room
  for (const [socketId, user] of roomUsers.entries()) {
    logSystem(`📦 Preparing panel for ${user.name} → ${user.state}`);
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

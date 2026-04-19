import { ActionPayload, ActionContext, filterUsersByRoom } from "../routeAction";
import { emojiLookup } from "../../avatarManager"; // adjust path if needed
import { getPanelConfigFor } from "../../panelConfigService";
import { getLiveSpeaker } from "../../socketHandler";

export function handleSelectMouth(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name: mouthClickerName } = payload;
  const { users, io, logAction, logSystem, roomId } = context;

  if (!mouthClickerName) {
    logSystem("🚨 Missing 'name' in selectMouth payload.");
    return;
  }

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  const avatarId =
    Array.from(roomUsers.values()).find((u) => u.name === mouthClickerName)
      ?.avatarId || "";
  const emoji = emojiLookup[avatarId] || "";

  logAction(
    `✋ ${emoji} ${mouthClickerName} clicked mouth — requesting to interrupt`
  );

  // Phase E: Find the speaker FIRST (before changing any states)
  const liveSpeakerName = getLiveSpeaker(roomId);
  const speakerEntry = liveSpeakerName
    ? Array.from(roomUsers.entries()).find(([, user]) => user.name === liveSpeakerName)
    : undefined;

  // Phase E: Now update all states (in this room):
  for (const [socketId, user] of roomUsers.entries()) {
    if (user.name === mouthClickerName) {
      user.state = "hasClickedMouth";
    } else {
      user.state = "waiting";
    }
    users.set(socketId, user); // Update in global map
  }

  // ✅ Set `interruptedBy` on the speaker
  if (speakerEntry) {
    const [speakerSocketId, speakerUser] = speakerEntry;
    speakerUser.interruptedBy = mouthClickerName;
    users.set(speakerSocketId, speakerUser);
  }

  // Phase E: Re-render panel configs for users in this room only
  for (const [socketId, user] of roomUsers.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

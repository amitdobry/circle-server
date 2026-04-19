import {
  ActionPayload,
  ActionContext,
  filterUsersByRoom,
} from "../routeAction";
import { emojiLookup } from "../../avatarManager"; // adjust path if needed
import { getPanelConfigFor } from "../../panelConfigService";
import { getLiveSpeaker } from "../../socketHandler";

export function handleSelectBrain(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name: brainClickerName } = payload;
  const { users, io, logSystem, logAction, roomId } = context;

  if (!brainClickerName) {
    logSystem("🚨 Missing 'name' in selectMouth payload.");
    return;
  }

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  const avatarId =
    Array.from(roomUsers.values()).find((u) => u.name === brainClickerName)
      ?.avatarId || "";
  const emoji = emojiLookup[avatarId] || "";

  logAction(
    `✋ ${emoji} ${brainClickerName} clicked brain — requesting to interrupt`,
  );

  // Phase E: Find the speaker in THIS ROOM FIRST (before changing any states)
  const liveSpeakerName = getLiveSpeaker(roomId);
  const speakerEntry = liveSpeakerName
    ? Array.from(roomUsers.entries()).find(
        ([, user]) => user.name === liveSpeakerName,
      )
    : undefined;

  // Phase E: Now update states for users in THIS ROOM ONLY
  for (const [socketId, user] of roomUsers.entries()) {
    if (user.name === brainClickerName) {
      user.state = "hasClickedBrain";
    } else {
      user.state = "waiting";
    }
    users.set(socketId, user); // Update in global map
  }

  // ✅ Set `interruptedBy` on the speaker
  if (speakerEntry) {
    const [speakerSocketId, speakerUser] = speakerEntry;
    speakerUser.interruptedBy = brainClickerName;
    users.set(speakerSocketId, speakerUser);
  }

  // Phase E: Re-render panel configs for users in THIS ROOM ONLY
  for (const [socketId, user] of roomUsers.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

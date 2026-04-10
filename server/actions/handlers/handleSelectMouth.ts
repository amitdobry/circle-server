import { ActionPayload, ActionContext } from "../routeAction";
import { emojiLookup } from "../../avatarManager"; // adjust path if needed
import { getPanelConfigFor } from "../../panelConfigService";
import { getLiveSpeaker } from "../../socketHandler";

export function handleSelectMouth(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name: mouthClickerName } = payload;
  const { users, io, logAction, logSystem } = context;

  if (!mouthClickerName) {
    logSystem("🚨 Missing 'name' in selectMouth payload.");
    return;
  }

  const avatarId =
    Array.from(users.values()).find((u) => u.name === mouthClickerName)
      ?.avatarId || "";
  const emoji = emojiLookup[avatarId] || "";

  logAction(
    `✋ ${emoji} ${mouthClickerName} clicked mouth — requesting to interrupt`
  );

  // ✅ Find the speaker FIRST (before changing any states)
  const liveSpeakerName = getLiveSpeaker();
  const speakerEntry = liveSpeakerName
    ? Array.from(users.entries()).find(([, user]) => user.name === liveSpeakerName)
    : undefined;

  // ✅ Now update all states:
  for (const [socketId, user] of users.entries()) {
    if (user.name === mouthClickerName) {
      user.state = "hasClickedMouth";
    } else {
      user.state = "waiting";
    }
    users.set(socketId, user);
  }

  // ✅ Set `interruptedBy` on the speaker
  if (speakerEntry) {
    const [speakerSocketId, speakerUser] = speakerEntry;
    speakerUser.interruptedBy = mouthClickerName;
    users.set(speakerSocketId, speakerUser);
  }

  // ✅ Re-render panel configs for everyone
  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

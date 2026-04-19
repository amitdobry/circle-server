import { getPanelConfigFor } from "../../panelConfigService";
import { ActionPayload, ActionContext, filterUsersByRoom } from "../routeAction";
import { setPointer } from "../../socketHandler";

export function handleConcentNewSpeakerFromMicDropped(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name } = payload;
  const { users, pointerMap, io, logAction, logSystem, roomId } = context;

  if (!name) {
    logSystem(
      "🚨 Missing name in handleConcentNewSpeakerFromMicDropped payload.",
    );
    return;
  }

  let speakerCandidate: string | null = null;
  let socketIdOfResponder: string | null = null;

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  // 🧠 Find responder socket ID and the first "wantsToPickUpTheMic" user
  for (const [socketId, user] of roomUsers.entries()) {
    logSystem(`🔍 SCAN [${socketId}] ${user.name} → state: ${user.state}`);
    if (user.name === name) {
      socketIdOfResponder = socketId;
    }
    if (!speakerCandidate && user.state === "wantsToPickUpTheMic") {
      speakerCandidate = user.name;
    }
  }

  if (!speakerCandidate || !socketIdOfResponder) {
    logSystem("🚨 Could not find speakerCandidate or responder.");
    return;
  }

  // 👆 Set pointer and update state
  setPointer(name, speakerCandidate, roomId);
  io.to(roomId).emit("update-pointing", { from: name, to: speakerCandidate });

  const responder = users.get(socketIdOfResponder);
  if (responder) {
    responder.state = "waitingForOthersAfterMicDropAndConcentNewSpeaker";
    users.set(socketIdOfResponder, responder);
  }

  logAction(
    `👂 ${name} gave consent for ${speakerCandidate} to pick up the mic`,
  );

  // Phase E: 🔁 Refresh panels for users in this room
  for (const [socketId, user] of roomUsers.entries()) {
    logAction(`📦 Preparing panel for ${user.name} → ${user.state}`);
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

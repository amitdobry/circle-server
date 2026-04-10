import { getPanelConfigFor } from "../../panelConfigService";
import { ActionPayload, ActionContext } from "../routeAction";
import { setPointer } from "../../socketHandler";

export function handleConcentNewSpeakerFromMicDropped(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name } = payload;
  const { users, pointerMap, io, logAction, logSystem } = context;

  if (!name) {
    logSystem(
      "🚨 Missing name in handleConcentNewSpeakerFromMicDropped payload.",
    );
    return;
  }

  let speakerCandidate: string | null = null;
  let socketIdOfResponder: string | null = null;

  // 🧠 Find responder socket ID and the first "wantsToPickUpTheMic" user
  for (const [socketId, user] of users.entries()) {
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
  setPointer(name, speakerCandidate);
  io.emit("update-pointing", { from: name, to: speakerCandidate });

  const responder = users.get(socketIdOfResponder);
  if (responder) {
    responder.state = "waitingForOthersAfterMicDropAndConcentNewSpeaker";
    users.set(socketIdOfResponder, responder);
  }

  logAction(
    `👂 ${name} gave consent for ${speakerCandidate} to pick up the mic`,
  );

  // 🔁 Refresh panels for everyone
  for (const [socketId, user] of users.entries()) {
    logAction(`📦 Preparing panel for ${user.name} → ${user.state}`);
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

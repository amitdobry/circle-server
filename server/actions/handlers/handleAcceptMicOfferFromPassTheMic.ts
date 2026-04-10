import { ActionPayload, ActionContext } from "../routeAction";
import { getPanelConfigFor } from "../../panelConfigService";
import { setPointer } from "../../socketHandler";

export function handleAcceptMicOfferFromPassTheMic(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name } = payload;
  const { users, io, logAction, logSystem, evaluateSync, pointerMap } = context;

  if (!name) {
    logSystem("🚨 Missing name in acceptMicOffer handler.");
    return;
  }

  logSystem(`🙋 ${name} accepted the mic — starting group consent process.`);

  let postSpeakerName: string | undefined = undefined;

  // Step 1: Assign states
  for (const [socketId, user] of users.entries()) {
    // 🙋 Target user who accepted
    if (user.name === name) {
      user.state = "wantsToPickUpTheMic";
      setPointer(user.name, user.name); // ✅ Point to self
    }

    // 🧘 Speaker who previously offered
    else if (user.state === "hasOfferedMicToUserFromPassTheMic") {
      user.state = "waitingForOthersAfterMicDropAndConcentNewSpeaker";
      postSpeakerName = user.name;
    }

    // 👂 Everyone else
    else {
      user.state = "appendingConcentToPickUpTheMic";
    }

    users.set(socketId, user);
  }

  // Step 2: Emit updated panels
  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }

  evaluateSync(); // ✅ Trigger sync check
}

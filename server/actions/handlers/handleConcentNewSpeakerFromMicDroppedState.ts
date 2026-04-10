import { getPanelConfigFor } from "../../panelConfigService";
import { ActionPayload, ActionContext } from "../routeAction";
import { setPointer, setLiveSpeaker, setIsSyncPauseMode } from "../../socketHandler";
import { dispatchAndRun } from "../../engine-v2/reducer/dispatch";
import * as ActionTypes from "../../engine-v2/actions/actionTypes";

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

  // Check if all consenting users have now given consent.
  // Responder state was updated above — if nobody is left in
  // appendingConcentToPickUpTheMic, we have full consensus.
  const remainingConsenters = Array.from(users.values()).filter(
    (u) => u.state === "appendingConcentToPickUpTheMic",
  ).length;

  if (remainingConsenters === 0) {
    // 🎉 Consensus complete — new speaker goes LIVE

    // Reset V1 user states before panel rebuild
    for (const [sid, user] of users.entries()) {
      user.state = user.name === speakerCandidate ? "speaking" : "regular";
      users.set(sid, user);
    }

    // Sync V1 globals so panelBuilderRouter routes correctly
    setLiveSpeaker(speakerCandidate);
    setIsSyncPauseMode(false);

    // Sync V2 via ACCEPT_MIC → fires REBUILD_ALL_PANELS which emits panels to everyone
    const speakerSocketId =
      Array.from(users.entries()).find(([, u]) => u.name === speakerCandidate)?.[0] ?? null;
    try {
      dispatchAndRun(
        "default-room",
        speakerSocketId,
        { type: ActionTypes.ACCEPT_MIC, payload: {} },
        io,
      );
    } catch (err) {
      logSystem(`🚨 V2 ACCEPT_MIC dispatch failed: ${err}`);
      // Fallback: emit panels via V1
      for (const [socketId, user] of users.entries()) {
        const config = getPanelConfigFor(user.name);
        io.to(socketId).emit("receive:panelConfig", config);
      }
    }
  } else {
    // Not yet consensus — emit intermediate panels via V1
    for (const [socketId, user] of users.entries()) {
      logAction(`📦 Preparing panel for ${user.name} → ${user.state}`);
      const config = getPanelConfigFor(user.name);
      io.to(socketId).emit("receive:panelConfig", config);
    }
  }
}

import { ActionPayload, ActionContext } from "../routeAction";
import { getPanelConfigFor } from "../../panelConfigService";

export function handleOpenChooseASpeakerFromPassTheMic(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, io, logSystem, logAction, evaluateSync } = context;

  if (!name) {
    logSystem(
      "🚨 Missing name in handleOpenChooseASpeakerFromPassTheMic payload."
    );
    return;
  }

  logAction(`🎯 ${name} is choosing a user to pass the mic to.`);

  for (const [socketId, user] of users.entries()) {
    if (user.name === name) {
      user.state = "isChoosingUserToPassMic";
      users.set(socketId, user);
    }
  }

  for (const [socketId, user] of users.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }

  evaluateSync();
}

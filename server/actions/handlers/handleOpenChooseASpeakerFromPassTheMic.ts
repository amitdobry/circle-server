import { ActionPayload, ActionContext, filterUsersByRoom } from "../routeAction";
import { getPanelConfigFor } from "../../panelConfigService";
import { setLiveSpeaker } from "../../socketHandler";

export function handleOpenChooseASpeakerFromPassTheMic(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name } = payload;
  const { users, io, logSystem, logAction, roomId } = context;

  if (!name) {
    logSystem(
      "🚨 Missing name in handleOpenChooseASpeakerFromPassTheMic payload."
    );
    return;
  }

  logAction(`🎯 ${name} is choosing a user to pass the mic to.`);

  // Speaker is no longer "live" — clear so panelBuilderRouter routes
  // them to buildListenerSyncPanel → state-13 (participant picker)
  setLiveSpeaker(null, roomId);

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  for (const [socketId, user] of roomUsers.entries()) {
    if (user.name === name) {
      user.state = "isChoosingUserToPassMic";
      users.set(socketId, user);
    }
  }

  for (const [socketId, user] of roomUsers.entries()) {
    const config = getPanelConfigFor(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
  }
}

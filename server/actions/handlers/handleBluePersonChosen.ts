// handlers/handleBluePersonChosen.ts
// Called when a listener in "isPickingBlueSpeaker" state clicks a participant name.
// payload.name      = the picker (the listener who initiated)
// payload.targetUser = the participant they chose to hear from
import { ActionContext, ActionPayload, filterUsersByRoom } from "../routeAction";
import { getPanelConfigFor } from "../../panelConfigService";

export function handleBluePersonChosen(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name, targetUser, flavor } = payload;
  const { users, io, logAction, logSystem, roomId } = context;

  if (!name || !targetUser) {
    logSystem("🟦 handleBluePersonChosen: missing name or targetUser");
    return;
  }

  logAction(`🟦 ${name} chose ${targetUser} (${flavor ?? "no flavor"})`);

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  // Reset picker back to regular listener state
  for (const [socketId, user] of roomUsers.entries()) {
    if (user.name === name) {
      user.state = "regular";
      users.set(socketId, user);

      const config = getPanelConfigFor(user.name);
      io.to(socketId).emit("receive:panelConfig", config);
      return;
    }
  }

  logSystem(`🟦 handleBluePersonChosen: user "${name}" not found in room`);
}

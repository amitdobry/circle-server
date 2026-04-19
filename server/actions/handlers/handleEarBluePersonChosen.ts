// handlers/handleEarBluePersonChosen.ts
// Called when a listener in "isPickingEarBluePerson" state clicks a participant name.
// payload.name       = the picker
// payload.targetUser = the participant they chose to hear from
import { ActionContext, ActionPayload, filterUsersByRoom } from "../routeAction";
import { getPanelConfigFor } from "../../panelConfigService";
import { createGliffLog } from "../../gliffLogService";

export function handleEarBluePersonChosen(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name, targetUser } = payload;
  const { users, io, logAction, logSystem, roomId } = context;

  if (!name || !targetUser) {
    logSystem("🟦 handleEarBluePersonChosen: missing name or targetUser");
    return;
  }

  const label = `I'd love to hear from '${targetUser}'`;

  logAction(`🟦 ${name}: ${label}`);

  createGliffLog(
    {
      userName: name,
      message: {
        messageType: "gesture",
        content: label,
        emoji: "🙋",
        timestamp: Date.now(),
      },
    },
    io,
    roomId, // Phase E: Use actual roomId, not hardcoded "default-room"
  );

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

  logSystem(`🟦 handleEarBluePersonChosen: user "${name}" not found in room`);
}

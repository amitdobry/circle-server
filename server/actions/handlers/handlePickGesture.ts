import { ActionContext, ActionPayload, filterUsersByRoom } from "../routeAction";
import { getPanelConfigFor } from "../../panelConfigService";

export function handlePickGesture(
  payload: ActionPayload,
  context: ActionContext
) {
  const { name, subType } = payload;
  const { users, io, logAction, logSystem, roomId } = context;

  if (!name || !subType) {
    logSystem("🚨 Missing name or subType in pickGesture payload");
    return;
  }

  logAction(`🎯 ${name} picked gesture: ${subType}`);

  // Phase E: Filter users to only this room
  const roomUsers = filterUsersByRoom(users, roomId, io);

  // Find user and attach subgesture info
  const userEntry = Array.from(roomUsers.entries()).find(
    ([, u]) => u.name === name
  );
  if (!userEntry) {
    logSystem(`⚠️ Could not find user: ${name}`);
    return;
  }

  const [socketId, user] = userEntry;

  // Update user state (you could make a dedicated subfield if needed)
  user.state = `gesture:${subType}` as any; // or attach `user.gesture = subType`
  users.set(socketId, user);

  // Emit updated config to the user only
  const config = getPanelConfigFor(user.name);
  io.to(socketId).emit("receive:panelConfig", config);
}

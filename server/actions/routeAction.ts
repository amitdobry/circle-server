import { Server } from "socket.io";
import { gestureCatalog } from "../ui-config/gestureCatalog";
import { config } from "./actionConfig";
import { handlersMap } from "./handlersMap"; // we'll set this up

type ActionPayload = {
  name?: string;
  type?: string;
  code?: string;
  subType?: string;
  actionType?: string;
  from?: string;
  to?: string;
  targetUser?: string; // ✅ Add this line
  flavor?: string; // ✅ Add this line
  // more fields in future...
};
type UserState =
  | "regular"
  | "speaking"
  | "thinking"
  | "waiting"
  | "hasClickedEar"
  | "hasClickedMouth"
  | "hasClickedBrain"
  | "hasDroppedTheMic"
  | "micIsDropped"
  | "isPassingTheMic"
  | "micPassInProcess"
  | "isChoosingUserToPassMic"
  | "micOfferReceivedFromPassTheMic"
  | "awaitingUserMicOfferResolutionFromPassTheMic"
  | "micOfferReceivedFromPassTheMic"
  | "hasOfferedMicToUserFromPassTheMic"
  | "awaitingUserMicOfferResolutionFromPassTheMic"
  | "offerMicToUserFromPassTheMic"
  | "acceptMicOfferFromPassTheMic"
  | "wantsToPickUpTheMic"
  | "appendingConcentToPickUpTheMic"
  | "doesNotWantToPickUpTheMic"
  | "waitingForOthersAfterMicDropAndConcentNewSpeaker"
  | "waitingOnPickerOfBlueSpeaker"
  | "isPickingBlueSpeaker"
  | "postSpeakerWaitingOnBlue"
  | "isPickingEarBluePerson";

type ActionContext = {
  io: Server;
  logSystem: (msg: string) => void;
  logAction: (msg: string) => void;
  pointerMap: Map<string, string | null>;
  gestureCatalog: typeof gestureCatalog;
  socketId: string;
  roomId: string; // Phase E: Room context for multi-table
  users: Map<
    string,
    { name: string; avatarId: string; state: UserState; interruptedBy: string }
  >;
};

/**
 * Phase E: Helper to filter users to only those in the specified room
 * @param users - Global users Map
 * @param roomId - Room ID to filter by
 * @param io - Socket.IO server instance (to check socket.data.roomId)
 * @returns Map of users only in the specified room
 */
function filterUsersByRoom(
  users: Map<
    string,
    { name: string; avatarId: string; state: UserState; interruptedBy: string }
  >,
  roomId: string,
  io: Server,
): Map<
  string,
  { name: string; avatarId: string; state: UserState; interruptedBy: string }
> {
  const roomUsers = new Map();

  for (const [socketId, user] of users.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    const socketRoomId = socket?.data?.roomId || socket?.data?.tableId;

    if (socketRoomId === roomId) {
      roomUsers.set(socketId, user);
    }
  }

  return roomUsers;
}

function routeAction(payload: ActionPayload, context: ActionContext) {
  const { actionType, type } = payload;

  const match = config.find(
    (entry) =>
      entry.actionType === actionType && (!entry.type || entry.type === type),
  );

  if (!match) {
    console.warn("[Router] ❌ No matching handler found for:", payload);
    return;
  }

  const handler = handlersMap[match.handler];

  if (!handler) {
    console.warn(`[Router] ❌ Handler not implemented: ${match.handler}`);
    return;
  }

  handler(payload, context);
}

export { routeAction, ActionContext, ActionPayload, filterUsersByRoom };

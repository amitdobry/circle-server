import { Server } from "socket.io";
import { gestureCatalog } from "../ui-config/gestureCatalog";
import { config } from "./actionConfig";
import { handlersMap } from "./handlersMap"; // we'll set this up

type ActionPayload = {
  name?: string;
  type?: string;
  subType?: string;
  actionType?: string;
  from?: string;
  to?: string;
  targetUser?: string; // ✅ Add this line
  // more fields in future...
};
type UserState =
  | "regular"
  | "speaking"
  | "thinking"
  | "waiting"
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
  | "waitingForOthersAfterMicDropAndConcentNewSpeaker";

type ActionContext = {
  io: Server;
  log: (msg: string) => void;
  pointerMap: Map<string, string | null>;
  evaluateSync: () => void;
  gestureCatalog: typeof gestureCatalog;
  socketId: string;
  users: Map<
    string,
    { name: string; avatarId: string; state: UserState; interruptedBy: string }
  >;
};

function routeAction(payload: ActionPayload, context: ActionContext) {
  const { actionType, type } = payload;

  const match = config.find(
    (entry) =>
      entry.actionType === actionType && (!entry.type || entry.type === type)
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

export { routeAction, ActionContext, ActionPayload };

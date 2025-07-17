import { PanelConfig } from "./types/blockTypes";
import {
  getUsers,
  getPointerMap,
  getLiveSpeaker,
  getIsSyncPauseMode,
} from "./socketHandler";
import { panelBuilderRouter } from "./panelBuilderRouter";
import { log } from "console";

type UserState =
  | "regular"
  | "speaking"
  | "thinking"
  | "waiting"
  | "hasClickedMouth"
  | "hasClickedBrain"
  | "hasClickedEar"
  | "micIsDropped"
  | "hasDroppedTheMic"
  | "isPassingTheMic"
  | "micPassInProcess"
  | "isChoosingUserToPassMic"
  | "micOfferReceivedFromPassTheMic"
  | "hasOfferedMicToUserFromPassTheMic"
  | "awaitingUserMicOfferResolutionFromPassTheMic"
  | "appendingConcentToPickUpTheMic"
  | "wantsToPickUpTheMic"
  | "doesNotWantToPickUpTheMic"
  | "waitingForOthersAfterMicDropAndConcentNewSpeaker";

export type UserInfo = {
  name: string;
  avatarId: string;
  state: UserState;
  interruptedBy?: string;
};

export type PanelContext = {
  userName: string;
  userIsParticipant: boolean;
  liveSpeaker: string | null;
  isUserSpeaker: boolean;
  isSyncPauseMode: boolean;
  totalParticipants: number;
  // wasInterruptedBy: string;
  participantNames: string[];
  pointerMap: Map<string, string>;
  allUsers: Map<string, UserInfo>; // ✅ Add this line
};

export function collectPanelContext(userName: string): PanelContext {
  const allUsers = getUsers(); // full Map<string, UserInfo>
  const participantList = Array.from(getUsers().values()).map((u) => u.name);
  const userIsParticipant = participantList.includes(userName);
  const currentLiveSpeaker = getLiveSpeaker();
  const currentPointerMap = getPointerMap();
  const isSyncPauseMode = getIsSyncPauseMode();

  return {
    userName,
    userIsParticipant,
    // wasInterruptedBy: interruptingUser,
    liveSpeaker: currentLiveSpeaker,
    isUserSpeaker: currentLiveSpeaker === userName,
    isSyncPauseMode: isSyncPauseMode,
    totalParticipants: participantList.length,
    participantNames: participantList,
    pointerMap: currentPointerMap,
    allUsers,
  };
}

export function getPanelConfigFor(userName: string): PanelConfig {
  const context = collectPanelContext(userName);
  const user = Array.from(context.allUsers.values()).find(
    (u) => u.name === userName
  );

  if (user) {
    console.log(
      `📦 Preparing panel at panelConfigService for ${user.name} → ${user.state}`
    );
  } else {
    console.warn(`⚠️ No user found in context for ${userName}`);
  }
  return panelBuilderRouter(context);
}

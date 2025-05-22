import { PanelConfig } from "./types/blockTypes";
import { getUsers, getPointerMap, getLiveSpeaker } from "./socketHandler";
import { panelBuilderRouter } from "./panelBuilderRouter";

type UserState =
  | "regular"
  | "speaking"
  | "thinking"
  | "waiting"
  | "hasClickedMouth"
  | "hasClickedBrain"
  | "micIsDropped"
  | "hasDroppedTheMic"
  | "appendingConcentToPickUpTheMic"
  | "wantsToPickUpTheMic";

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

  return {
    userName,
    userIsParticipant,
    // wasInterruptedBy: interruptingUser,
    liveSpeaker: currentLiveSpeaker,
    isUserSpeaker: currentLiveSpeaker === userName,
    totalParticipants: participantList.length,
    participantNames: participantList,
    pointerMap: currentPointerMap,
    allUsers,
  };
}

export function getPanelConfigFor(userName: string): PanelConfig {
  const context = collectPanelContext(userName);
  return panelBuilderRouter(context);
}

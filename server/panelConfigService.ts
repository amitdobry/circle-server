import { PanelConfig } from "./types/blockTypes";
import {
  getUsers,
  getUserRoomId,
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
  | "isPickingBlueSpeaker"
  | "waitingOnPickerOfBlueSpeaker"
  | "postSpeakerWaitingOnBlue"
  | "isPickingEarBluePerson"
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

  // 🆕 Content Phase (Content Phase Feature)
  contentPhaseActive: boolean;
  contentPhaseConfig: any | null;
  userHasVoted: boolean;
  userVote: string | null;

  // 🆕 Current Round (Content Phase Feature)
  currentRound: {
    roundNumber: number;
    glyphText: string;
    subjectKey: string;
    status: "active" | "ended";
    userIsReady: boolean;
    readyCount: number;
    totalCount: number;
  } | null;
};

export function collectPanelContext(
  userName: string,
  roomId?: string,
): PanelContext {
  // Phase E: Get user's room ID
  // ✅ FIX: Use provided roomId from REBUILD_ALL_PANELS instead of looking up
  const userRoomId = roomId || getUserRoomId(userName) || "default-room";

  // Get room-filtered data
  const allUsers = getUsers(userRoomId); // filtered by room
  const participantList = Array.from(allUsers.values()).map((u) => u.name);
  const userIsParticipant = participantList.includes(userName);
  const currentLiveSpeaker = getLiveSpeaker(userRoomId);
  const currentPointerMap = getPointerMap(userRoomId);
  const isSyncPauseMode = getIsSyncPauseMode(userRoomId);

  // 🆕 Content Phase context (Content Phase Feature)
  const { FEATURE_CONTENT_PHASE } = require("./config/featureFlags");
  let contentPhaseActive = false;
  let contentPhaseConfig = null;
  let userHasVoted = false;
  let userVote = null;
  let currentRound = null;

  if (FEATURE_CONTENT_PHASE) {
    const { roomRegistry } = require("./engine-v2/registry/RoomRegistry");
    const {
      contentConfigLoader,
    } = require("./config/content/ContentConfigLoader");
    const { getTableDefinition } = require("./ui-config/tableDefinitions");

    const tableState = roomRegistry.getRoom(userRoomId);
    contentPhaseActive = tableState?.phase === "CONTENT_PHASE";

    console.log(
      `[PanelConfig DEBUG] room=${userRoomId} phase=${tableState?.phase} contentPhaseActive=${contentPhaseActive} tableId=${tableState?.tableId}`,
    );

    if (contentPhaseActive && tableState?.contentPhase) {
      // 🆕 ISSUE 3 FIX: Get table definition using tableId, not roomId
      const tableDefinition = getTableDefinition(tableState.tableId);

      if (!tableDefinition || !tableDefinition.content) {
        console.error(
          `[PanelConfig] No table definition for table: ${tableState.tableId}`,
        );
      } else {
        // Get full theme config for descriptions
        const themeConfig = contentConfigLoader.getConfig(
          tableDefinition.content.themeKey,
        );

        if (themeConfig) {
          // 🆕 Filter subjects based on table definition
          const tableSubjects = tableDefinition.content.subjects;
          const availableSubjects = themeConfig.subjects.filter((s: any) =>
            tableSubjects.some((ts: any) => ts.key === s.key),
          );

          contentPhaseConfig = {
            title: themeConfig.phaseTitle,
            subtitle: themeConfig.phaseSubtitle,
            subjects: availableSubjects.map((s: any) => ({
              key: s.key,
              label: s.label,
              description: s.description,
            })),
          };
        }

        // Find user's vote
        for (const [userId, vote] of tableState.contentPhase.votes) {
          const participant = tableState.participants.get(userId);
          if (participant?.displayName === userName) {
            userHasVoted = true;
            userVote = vote;
            break;
          }
        }
      }
    }

    // 🆕 Collect currentRound info
    if (tableState?.currentRound) {
      const round = tableState.currentRound;

      // Find user's participant record to check if they're ready
      let userParticipant = null;
      for (const [userId, participant] of tableState.participants) {
        if (participant.displayName === userName) {
          userParticipant = participant;
          break;
        }
      }

      const userIsReady = userParticipant
        ? round.readyUserIds.has(userParticipant.userId)
        : false;

      // Count ready users
      const activeUserIds = Array.from(tableState.participants.values())
        .filter((p: any) => p.presence === "CONNECTED")
        .map((p: any) => p.userId);

      currentRound = {
        roundNumber: round.roundNumber,
        glyphText: round.glyphText,
        subjectKey: round.subjectKey,
        status: round.status,
        userIsReady,
        readyCount: round.readyUserIds.size,
        totalCount: activeUserIds.length,
      };

      console.log(
        `[PanelConfig DEBUG] currentRound: Round ${currentRound.roundNumber}, ready=${currentRound.readyCount}/${currentRound.totalCount}, userReady=${userIsReady}`,
      );
    }
  }

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
    // 🆕 Content Phase context
    contentPhaseActive,
    contentPhaseConfig,
    userHasVoted,
    userVote,
    // 🆕 Current Round context
    currentRound,
  };
}

export function getPanelConfigFor(
  userName: string,
  roomId?: string,
): PanelConfig {
  const context = collectPanelContext(userName, roomId);
  const user = Array.from(context.allUsers.values()).find(
    (u) => u.name === userName,
  );

  if (user) {
    console.log(
      `📦 Preparing panel at panelConfigService for ${user.name} → ${user.state}`,
    );
  } else {
    console.warn(`⚠️ No user found in context for ${userName}`);
  }

  const config = panelBuilderRouter(context);

  // V1 panel snapshot — compare against [PANEL-SNAPSHOT][V2] to detect override races
  const pointerEntries =
    Array.from(context.pointerMap.entries())
      .map(([k, v]) => `${k}→${v}`)
      .join(", ") || "(empty)";
  const panelType =
    context.totalParticipants === 1
      ? "waiting"
      : context.contentPhaseActive
        ? "content-phase"
        : context.liveSpeaker
          ? context.isUserSpeaker
            ? "speaker"
            : "listener-sync"
          : context.isSyncPauseMode
            ? "listener-sync(pause)"
            : "attention";
  console.log(
    `[PANEL-SNAPSHOT][V1] user=${userName} panelType=${panelType} liveSpeaker=${
      context.liveSpeaker ?? "none"
    } isSyncPauseMode=${context.isSyncPauseMode} participants=${
      context.totalParticipants
    } pointerMap={${pointerEntries}}`,
  );

  return config;
}

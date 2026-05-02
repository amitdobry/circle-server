import { buildAttentionPanel } from "./attentionPanel/attentionPanelBuilder";
import { buildListenerSyncPanel } from "./listenersPanel/listenersPanelBuilder";
import { PanelContext } from "./panelConfigService";
import { buildSpeakerPanel } from "./speakerPanel/speakerPanelBuilder";
import { buildWaitingPanel } from "./waitingPanel/waitingPanelBuilder";
import {
  PanelConfig,
  SubjectSelectionBlock,
  RoundDisplayBlock,
  PanelSection,
} from "./types/blockTypes";

/**
 * Build Round UI section (🆕 Round Display Feature)
 * Shows Glyph and readiness controls at the top of any panel
 */
function buildRoundSection(ctx: PanelContext): PanelSection {
  if (!ctx.currentRound) {
    throw new Error("buildRoundSection called without currentRound");
  }

  const roundBlock: RoundDisplayBlock = {
    id: "round-display",
    type: "roundDisplay",
    roundNumber: ctx.currentRound.roundNumber,
    glyphText: ctx.currentRound.glyphText,
    subjectKey: ctx.currentRound.subjectKey,
    userIsReady: ctx.currentRound.userIsReady,
    readyCount: ctx.currentRound.readyCount,
    totalCount: ctx.currentRound.totalCount,
  };

  return {
    id: "round-display-section",
    layout: "column",
    panelType: "round-display",
    label: "",
    blocks: [roundBlock],
  };
}

/**
 * Build Content Phase Panel (🆕 Content Phase Feature)
 */
function buildContentPhasePanel(ctx: PanelContext): PanelConfig {
  const config = ctx.contentPhaseConfig;

  if (!config) {
    return buildAttentionPanel(ctx); // Fallback
  }

  // Create the SubjectSelectionBlock explicitly to avoid type inference issues
  const subjectSelectionBlock: SubjectSelectionBlock = {
    id: "subject-selection-block",
    type: "subjectSelection",
    subjects: config.subjects,
    selectedSubject: ctx.userVote,
    hasVoted: ctx.userHasVoted,
  };

  return [
    {
      id: "content-phase-header",
      layout: "column",
      panelType: "content-phase",
      label: "",
      blocks: [
        {
          id: "content-phase-title",
          type: "text",
          content: "Choose Your Focus",
          size: "2xl",
          align: "center",
          style: "text-black font-bold",
          textClass: "text-2xl font-bold text-center mb-2",
        },
        {
          id: "content-phase-subtitle",
          type: "text",
          content: "Select a philosophical subject for this round",
          size: "base",
          align: "center",
          style: "text-gray-600",
          textClass:
            "text-base text-gray-600 text-center mb-6 max-w-lg mx-auto",
        },
      ],
    },
    {
      id: "content-phase-subjects",
      layout: "column",
      panelType: "content-phase",
      label: "",
      panelStyle: "w-full max-w-2xl mx-auto",
      blocks: [subjectSelectionBlock],
    },
    ...(ctx.userHasVoted
      ? [
          {
            id: "content-phase-waiting",
            layout: "row" as const,
            panelType: "content-phase",
            label: "",
            blocks: [
              {
                id: "waiting-message",
                type: "text" as const,
                content: "⏳ Waiting for others to vote...",
                size: "base",
                align: "center",
                style: "text-gray-500 italic",
                textClass: "text-base text-gray-500 italic text-center mt-4",
              },
            ],
          },
        ]
      : []),
  ];
}

export function panelBuilderRouter(ctx: PanelContext): PanelConfig {
  // 🆕 Content Phase takes priority — even for a single remaining user.
  // A user in an active vote must NOT be sent to the waiting panel just
  // because other participants left; they still need to cast their vote.
  console.log(
    `[Router DEBUG] contentPhaseActive=${ctx.contentPhaseActive} hasConfig=${!!ctx.contentPhaseConfig} currentRound=${!!ctx.currentRound}`,
  );

  if (ctx.contentPhaseActive && ctx.contentPhaseConfig) {
    console.log("[Router DEBUG] → Routing to buildContentPhasePanel");
    return buildContentPhasePanel(ctx);
  }

  // 🚨 CRITICAL: Single user = WAITING_FOR_USERS state
  if (ctx.totalParticipants === 1) {
    console.log(
      "[Router DEBUG] → Single user, routing to WAITING_FOR_USERS panel",
    );
    return buildWaitingPanel(ctx);
  }

  // 🆕 Route to appropriate base panel
  // Note: Round UI (glyph + readiness) is handled outside the panel system
  // in TableView.tsx via <Glyph> and <RoundReadinessRow> components
  if (!ctx.userIsParticipant) {
    return buildAttentionPanel(ctx); //this is just for now
  } else if (ctx.liveSpeaker || ctx.isSyncPauseMode) {
    if (ctx.isUserSpeaker) {
      return buildSpeakerPanel(ctx);
    } else {
      return buildListenerSyncPanel(ctx);
    }
  } else {
    return buildAttentionPanel(ctx);
  }
}

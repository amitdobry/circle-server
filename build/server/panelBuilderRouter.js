"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.panelBuilderRouter = panelBuilderRouter;
const attentionPanelBuilder_1 = require("./attentionPanel/attentionPanelBuilder");
const listenersPanelBuilder_1 = require("./listenersPanel/listenersPanelBuilder");
const speakerPanelBuilder_1 = require("./speakerPanel/speakerPanelBuilder");
const waitingPanelBuilder_1 = require("./waitingPanel/waitingPanelBuilder");
/**
 * Build Round UI section (🆕 Round Display Feature)
 * Shows Glyph and readiness controls at the top of any panel
 */
function buildRoundSection(ctx) {
    if (!ctx.currentRound) {
        throw new Error("buildRoundSection called without currentRound");
    }
    const roundBlock = {
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
function buildContentPhasePanel(ctx) {
    const config = ctx.contentPhaseConfig;
    if (!config) {
        return (0, attentionPanelBuilder_1.buildAttentionPanel)(ctx); // Fallback
    }
    // Create the SubjectSelectionBlock explicitly to avoid type inference issues
    const subjectSelectionBlock = {
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
                    textClass: "text-base text-gray-600 text-center mb-6 max-w-lg mx-auto",
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
                    layout: "row",
                    panelType: "content-phase",
                    label: "",
                    blocks: [
                        {
                            id: "waiting-message",
                            type: "text",
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
function panelBuilderRouter(ctx) {
    // 🚨 CRITICAL: Single user = WAITING_FOR_USERS state
    // Must check FIRST before any other routing logic
    if (ctx.totalParticipants === 1) {
        console.log("[Router DEBUG] → Single user, routing to WAITING_FOR_USERS panel");
        return (0, waitingPanelBuilder_1.buildWaitingPanel)(ctx);
    }
    // 🆕 Content Phase takes priority (Content Phase Feature)
    console.log(`[Router DEBUG] contentPhaseActive=${ctx.contentPhaseActive} hasConfig=${!!ctx.contentPhaseConfig} currentRound=${!!ctx.currentRound}`);
    if (ctx.contentPhaseActive && ctx.contentPhaseConfig) {
        console.log("[Router DEBUG] → Routing to buildContentPhasePanel");
        return buildContentPhasePanel(ctx);
    }
    // 🆕 Build base panel (attention/speaker/listener)
    let basePanel;
    if (!ctx.userIsParticipant) {
        basePanel = (0, attentionPanelBuilder_1.buildAttentionPanel)(ctx); //this is just for now
    }
    else if (ctx.liveSpeaker || ctx.isSyncPauseMode) {
        if (ctx.isUserSpeaker) {
            basePanel = (0, speakerPanelBuilder_1.buildSpeakerPanel)(ctx);
        }
        else {
            basePanel = (0, listenersPanelBuilder_1.buildListenerSyncPanel)(ctx);
        }
    }
    else {
        basePanel = (0, attentionPanelBuilder_1.buildAttentionPanel)(ctx);
    }
    // 🆕 If currentRound exists, prepend round UI to base panel
    if (ctx.currentRound) {
        console.log(`[Router DEBUG] → Prepending round UI (Round ${ctx.currentRound.roundNumber})`);
        const roundSection = buildRoundSection(ctx);
        return [roundSection, ...basePanel];
    }
    return basePanel;
}

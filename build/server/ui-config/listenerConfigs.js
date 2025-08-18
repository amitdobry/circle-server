"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testPanelListenerState18 = exports.testPanelListenerState17 = exports.panelListenersWatchingMicOffer = exports.panelSpeakerWaitingForMicAcceptance = exports.panelListenerMicOfferReceived = exports.testPanelListenerState13 = exports.testPanelListenerState12 = exports.testPanelListenerState11 = exports.testPanelListenerState10 = exports.testPanelListenerState9 = exports.testPanelListenerState8 = exports.testPanelListenerState7 = exports.testPanelListenerState6 = exports.testPanelListenerState5 = exports.testPanelListenerState4 = exports.testPanelListenerState3 = exports.testPanelListenerState2 = exports.testPanelListenerState1 = void 0;
// State 1: Default (no active group)
exports.testPanelListenerState1 = [
    {
        id: "listener-top-bar",
        layout: "row",
        panelType: "listenerSyncPanel",
        label: "Listening to message",
        topScopeStyle: "w-full flex flex-col items-center gap-4",
        blocks: [
            {
                id: "listening-to-text",
                type: "text",
                content: "Listening to - Trump", // <-- this will get overridden
                size: "md",
                align: "center",
                style: "text-emerald-600 font-semibold",
                textClass: "text-center mb-2",
            },
        ],
    },
    {
        id: "listener-main-buttons",
        layout: "row",
        panelType: "listenerSyncPanel",
        label: "main gesture buttons",
        blocks: [
            {
                id: "reflect-btn",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-700 border-gray-300 hover:bg-emerald-400 hover:text-white hover:border-emerald-500 transition",
                button: {
                    label: "👂 Reflect",
                    type: "gesture", // universal listener button type
                    actionType: "selectEar", // open if closed, close if open
                    group: "ear", // which group this belongs to
                    control: "gesturePicking", // semantic meaning
                },
            },
            {
                id: "think-btn",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-700 border-gray-300 hover:bg-sky-400 hover:text-white hover:border-sky-500 transition",
                button: {
                    label: "🧠 Think",
                    type: "gesture", // universal listener button type
                    actionType: "selectBrain", // open if closed, close if open
                    group: "brain", // which group this belongs to
                    control: "thinkPause", // semantic meaning
                },
            },
            {
                id: "interrupt-btn",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-700 border-gray-300 hover:bg-rose-400 hover:text-white hover:border-rose-500 transition",
                button: {
                    label: "👄 Interrupt",
                    type: "gesture", // universal listener button type
                    actionType: "selectMouth", // open if closed, close if open
                    group: "mouth", // which group this belongs to
                    control: "thinkPause", // semantic meaning
                },
            },
        ],
    },
];
// State 2: Ear group active
exports.testPanelListenerState2 = [
    {
        id: "listener-main-buttons",
        layout: "row",
        panelType: "listenerSyncPanel",
        label: "main gesture buttons",
        blocks: [
            {
                id: "think-btn",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-700 border-gray-300 hover:bg-sky-400 hover:text-white hover:border-sky-500 transition",
                buttonClassSelected: "px-6 py-3 rounded-full text-base font-semibold border bg-sky-400 text-white border-sky-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300 shadow-sm transition-colors duration-150",
                button: {
                    label: "Stop Reflecting",
                    type: "gesture", // universal listener button type
                    actionType: "unSelectEar", // open if closed, close if open
                    group: "ear", // which group this belongs to
                    control: "gesturePicking", // semantic meaning
                },
            },
        ],
    },
    {
        id: "ear-sub-gesture-buttons",
        layout: "row",
        panelType: "listenerSyncPanel",
        panelStyle: "flex flex-wrap gap-2 justify-center mt-2",
        label: "sub gesture buttons",
        blocks: [
            {
                id: "ear-btn-1",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 hover:bg-yellow-200 text-yellow-700",
                button: {
                    label: "🤝 I feel you",
                    type: "semiListenerAction",
                    actionType: "feelYou",
                },
            },
            {
                id: "ear-btn-2",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-orange-100 hover:bg-orange-200 text-orange-700",
                button: {
                    label: "😕 I'm confusedd",
                    type: "semiListenerAction",
                    actionType: "confused",
                },
            },
            {
                id: "ear-btn-3",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-pink-100 hover:bg-pink-200 text-pink-700",
                button: {
                    label: "🙁 Not feeling it",
                    type: "semiListenerAction",
                    actionType: "notFeelingIt",
                },
            },
            {
                id: "ear-blue-love-to-hear",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-blue-100 hover:bg-blue-200 text-blue-700",
                button: {
                    label: "🙋 I’d love to hear…",
                    type: "listenerControl",
                    group: "blue",
                    actionType: "blueSelectStart",
                    flavor: "loveToHear",
                },
            },
        ],
    },
];
// State 3: Brain group active
exports.testPanelListenerState3 = [
    {
        id: "listener-main-buttons",
        layout: "row",
        panelType: "listenerSyncPanel",
        label: "main gesture buttons",
        blocks: [
            {
                id: "think-btn",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-700 border-gray-300 hover:bg-sky-400 hover:text-white hover:border-sky-500 transition",
                buttonClassSelected: "px-6 py-3 rounded-full text-base font-semibold border bg-sky-400 text-white border-sky-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300 shadow-sm transition-colors duration-150",
                button: {
                    label: "🧠 Stop Thinking",
                    type: "gesture", // universal listener button type
                    actionType: "unSelectBrain", // open if closed, close if open
                    group: "brain", // which group this belongs to
                    control: "thinkPause", // semantic meaning
                },
            },
        ],
    },
    {
        id: "listener-brain-semi",
        layout: "row",
        panelType: "listenerSyncPanel",
        panelStyle: "flex flex-wrap gap-2 justify-center mt-2",
        label: "sub gesture buttons",
        blocks: [
            {
                id: "brain-btn-1",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-blue-100 hover:bg-blue-200 text-blue-700",
                button: {
                    label: "🌊 Processing",
                    type: "semiListenerAction",
                    actionType: "processing",
                },
            },
            {
                id: "brain-btn-2",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-purple-100 hover:bg-purple-200 text-purple-700",
                button: {
                    label: "💭 Forming a thought",
                    type: "semiListenerAction",
                    actionType: "formingThought",
                },
            },
            {
                id: "brain-btn-3",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-indigo-100 hover:bg-indigo-200 text-indigo-700",
                button: {
                    label: "⏳ Need a moment",
                    type: "semiListenerAction",
                    actionType: "needMoment",
                },
            },
            {
                id: "brain-btn-4",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-emerald-100 hover:bg-emerald-200 text-emerald-700",
                button: {
                    label: "🤝 Connect This Thought",
                    type: "semiListenerAction",
                    actionType: "connectThought",
                },
            },
            {
                id: "brain-blue-spread-fire",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-blue-100 hover:bg-blue-200 text-blue-700",
                button: {
                    label: "🔥 Spread the fire",
                    type: "listenerControl",
                    group: "blue",
                    actionType: "blueSelectStart",
                    flavor: "spreadFire",
                },
            },
            {
                id: "brain-blue-hear-voices",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-sky-100 hover:bg-sky-200 text-sky-700",
                button: {
                    label: "🎶 Hear more voices",
                    type: "listenerControl",
                    group: "blue",
                    actionType: "blueSelectStart",
                    flavor: "hearMoreVoices",
                },
            },
            {
                id: "brain-blue-pass-flame",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-indigo-100 hover:bg-indigo-200 text-indigo-700",
                button: {
                    label: "🕯️ Pass the flame",
                    type: "listenerControl",
                    group: "blue",
                    actionType: "blueSelectStart",
                    flavor: "passFlame",
                },
            },
        ],
    },
];
// State 4: Mouth group active
exports.testPanelListenerState4 = [
    {
        id: "listener-main-buttons",
        layout: "row",
        panelType: "listenerSyncPanel",
        label: "main gesture buttons",
        blocks: [
            {
                id: "interrupt-btn",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-700 border-gray-300 hover:bg-rose-400 hover:text-white hover:border-rose-500 transition",
                buttonClassSelected: "px-6 py-3 rounded-full text-base font-semibold border bg-rose-400 text-white border-rose-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300 shadow-sm transition-colors duration-150",
                button: {
                    label: "👄 Interrupt",
                    type: "gesture", // universal listener button type
                    actionType: "unSelectMouth", // open if closed, close if open
                    group: "mouth", // which group this belongs to
                    control: "thinkPause", // semantic meaning
                    state: "selected",
                },
            },
        ],
    },
    {
        id: "listener-mouth-semi",
        layout: "row",
        panelType: "listenerSyncPanel",
        panelStyle: "flex flex-wrap gap-2 justify-center mt-2",
        label: "sub gesture buttons",
        blocks: [
            {
                id: "mouth-btn-1",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 hover:bg-yellow-200 text-yellow-700",
                button: {
                    label: "➕ Add on",
                    type: "semiListenerAction",
                    actionType: "addOn",
                },
            },
            {
                id: "mouth-btn-2",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-purple-100 hover:bg-purple-200 text-purple-700",
                button: {
                    label: "❓ Clarify",
                    type: "semiListenerAction",
                    actionType: "clarify",
                },
            },
            {
                id: "mouth-btn-3",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-pink-100 hover:bg-pink-200 text-pink-700",
                button: {
                    label: "❌ Disagree",
                    type: "semiListenerAction",
                    actionType: "disagree",
                },
            },
            {
                id: "mouth-blue-give-mic",
                type: "button",
                buttonClass: "px-4 py-2 rounded-full text-sm font-medium bg-blue-100 hover:bg-blue-200 text-blue-700",
                button: {
                    label: "🎤 Give the mic…",
                    type: "listenerControl",
                    group: "blue",
                    actionType: "blueSelectStart",
                    flavor: "giveMic",
                },
            },
        ],
    },
];
exports.testPanelListenerState5 = [
    {
        id: "listener-waiting-panel",
        layout: "column",
        panelType: "listenerSyncPanel",
        label: "Waiting for Listener Action",
        blocks: [
            {
                id: "listener-waiting-text",
                type: "text",
                content: "Another listener is responding...",
                size: "md",
                align: "center",
                style: "text-gray-600 font-semibold",
                textClass: "text-center text-sm text-gray-500",
            },
        ],
    },
];
exports.testPanelListenerState6 = [
    {
        id: "listener-mic-drop-text",
        layout: "column",
        panelType: "listenerSyncPanel",
        label: "Mic Dropped State",
        blocks: [
            {
                id: "mic-drop-message",
                type: "text",
                content: "🎤 Someone dropped the mic. Will you pick it up?",
                size: "md",
                align: "center",
                textClass: "text-gray-600 text-sm text-center font-medium",
            },
        ],
    },
    {
        id: "listener-mic-drop-buttons",
        layout: "row",
        panelType: "listenerSyncPanel",
        label: "Mic Decision Buttons",
        blocks: [
            {
                id: "raise-hand-button",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full text-base font-semibold border bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 transition",
                button: {
                    label: "✋ Raise Hand",
                    type: "listenerControl", // same routing as mic control
                    group: "mic",
                    actionType: "wishToSpeakAfterMicDropped",
                },
            },
            {
                id: "not-now-button",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 transition",
                button: {
                    label: "⏳ Not Now",
                    type: "listenerControl",
                    group: "mic",
                    actionType: "declineRequestAfterMicDropped",
                },
            },
        ],
    },
];
exports.testPanelListenerState7 = [
    {
        id: "mic-consent-text",
        layout: "column",
        panelType: "listenerSyncPanel",
        label: "Someone wants to pick up the mic",
        blocks: [
            {
                id: "mic-consent-message",
                type: "text",
                content: "🎤 Someone wants to pick up the mic. Listen to them?",
                size: "md",
                align: "center",
                textClass: "text-gray-700 text-center font-medium",
            },
        ],
    },
    {
        id: "mic-consent-buttons",
        layout: "row",
        panelType: "listenerSyncPanel",
        label: "Consent Buttons",
        blocks: [
            {
                id: "agree-btn",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full text-base font-semibold border bg-emerald-500 text-white border-emerald-600 shadow hover:bg-emerald-600 hover:scale-105 hover:shadow-lg transition-all duration-200",
                button: {
                    label: "👂 Concent",
                    type: "listenerControl", // same routing as mic control
                    group: "mic",
                    actionType: "concentNewSpeakerFromMicDropped",
                    targetUser: "PLACEHOLDER", // 🛠️ will be replaced in code
                },
            },
            {
                id: "decline-btn",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-600 border-gray-300 shadow hover:bg-gray-200 hover:scale-105 hover:shadow-md transition-all duration-200",
                button: {
                    label: "⏳ Not Yet",
                    type: "listenerControl",
                    control: "declineRequest",
                    group: "mic",
                    actionType: "declineNewCandidateRequestAfterMicDropped",
                },
            },
        ],
    },
];
exports.testPanelListenerState8 = [
    {
        id: "waiting-to-become-speaker",
        layout: "column",
        panelType: "listenerSyncPanel",
        label: "Awaiting Group Consent",
        blocks: [
            {
                id: "speaker-candidate-waiting-text",
                type: "text",
                content: "⏳ You’re asking to speak. Waiting for others to agree...",
                size: "md",
                align: "center",
                textClass: "text-gray-600 text-center font-medium",
            },
        ],
    },
];
exports.testPanelListenerState9 = [
    {
        id: "speaker-mic-drop-waiting",
        layout: "column",
        panelType: "speakerPanel",
        label: "Mic Dropped",
        blocks: [
            {
                id: "mic-drop-waiting-text",
                type: "text",
                content: "⏳ Waiting for others ...",
                size: "md",
                align: "center",
                textClass: "text-center text-gray-600 font-medium",
            },
        ],
    },
];
exports.testPanelListenerState10 = [
    {
        id: "Concent-mic-drop-pickup",
        layout: "column",
        panelType: "speakerPanel",
        label: "Mic Dropped",
        blocks: [
            {
                id: "mic-drop-waiting-text",
                type: "text",
                content: "⏳ Concent *** to pick up the mic Waiting for others ...",
                size: "md",
                align: "center",
                textClass: "text-center text-gray-600 font-medium",
            },
        ],
    },
];
exports.testPanelListenerState11 = [
    {
        id: "post-speaker-mic-drop-waiting",
        layout: "column",
        panelType: "speakerPanel",
        label: "Mic Dropped",
        blocks: [
            {
                id: "mic-drop-waiting-text",
                type: "text",
                content: "🎤 You dropped the mic. Waiting for the group to respond...",
                size: "md",
                align: "center",
                textClass: "text-center text-gray-600 font-medium",
            },
        ],
    },
];
exports.testPanelListenerState12 = [
    {
        id: "mic-pass-pending-panel",
        layout: "column",
        panelType: "statusPanel",
        panelStyle: "flex flex-col items-center justify-center px-4 py-6",
        label: "Awaiting Mic Transition",
        blocks: [
            {
                id: "mic-pass-waiting-text",
                type: "text",
                content: "🎤 The speaker is preparing to pass the mic...",
                size: "lg",
                align: "center",
                textClass: "text-gray-700 text-base font-semibold text-center",
            },
            {
                id: "mic-pass-subtext",
                type: "text",
                content: "Please stay tuned — a new voice may emerge soon.",
                size: "sm",
                align: "center",
                textClass: "text-gray-500 text-sm mt-2 text-center",
            },
        ],
    },
];
exports.testPanelListenerState13 = [
    {
        id: "choose-user-header",
        layout: "column",
        panelType: "speakerPanel",
        label: "Choose a Speaker",
        panelStyle: "flex flex-col items-center justify-center",
        blocks: [
            {
                id: "choose-user-instruction-text",
                type: "text",
                content: "Choose someone to pass the mic to:",
                size: "lg",
                align: "center",
                textClass: "text-center text-gray-700 font-semibold mb-4",
            },
        ],
    },
    {
        id: "choose-user-button-panel",
        layout: "row",
        panelType: "speakerPanel",
        label: "Participants",
        panelStyle: "flex flex-row justify-center gap-4 flex-wrap",
        blocks: [
            {
                id: "choose-amit-btn",
                type: "button",
                buttonClass: "px-5 py-3 rounded-full text-sm font-semibold border transition-all duration-200 bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:shadow-md hover:scale-105",
                button: {
                    label: "Amit",
                    type: "mic",
                    actionType: "offerMicToUserFromPassTheMic",
                    targetUser: "Amit",
                },
            },
            {
                id: "choose-oren-btn",
                type: "button",
                buttonClass: "px-5 py-3 rounded-full text-sm font-semibold border transition-all duration-200 bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:shadow-md hover:scale-105",
                button: {
                    label: "Oren",
                    type: "mic",
                    actionType: "offerMicToUserFromPassTheMic",
                    targetUser: "Oren",
                },
            },
            {
                id: "choose-leeron-btn",
                type: "button",
                buttonClass: "px-5 py-3 rounded-full text-sm font-semibold border transition-all duration-200 bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:shadow-md hover:scale-105",
                button: {
                    label: "Leeron",
                    type: "mic",
                    actionType: "offerMicToUserFromPassTheMic",
                    targetUser: "Leeron",
                },
            },
        ],
    },
];
exports.panelListenerMicOfferReceived = [
    {
        id: "mic-offer-received",
        layout: "column",
        panelType: "listenerSyncPanel",
        label: "Mic Offer",
        panelStyle: "flex flex-col items-center justify-center gap-4",
        blocks: [
            {
                id: "mic-offer-text",
                type: "text",
                content: "🎤 [SpeakerName] wants to pass you the mic. Will you speak?",
                size: "lg",
                align: "center",
                textClass: "text-center text-gray-700 font-semibold",
            },
        ],
    },
    {
        id: "mic-offer-buttons",
        layout: "row",
        panelType: "listenerSyncPanel",
        label: "Mic Offer Response",
        panelStyle: "flex flex-row justify-center gap-4",
        blocks: [
            {
                id: "mic-accept-btn",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full bg-emerald-500 text-white font-semibold hover:bg-emerald-600 hover:scale-105 transition-all",
                button: {
                    label: "Yes, I’ll speak",
                    type: "listenerControl",
                    control: "acceptRequest",
                    group: "mic",
                    actionType: "acceptMicOfferFromPassTheMic",
                },
            },
            {
                id: "mic-decline-btn",
                type: "button",
                buttonClass: "px-6 py-3 rounded-full bg-gray-300 text-gray-800 font-semibold hover:bg-gray-400 hover:scale-105 transition-all",
                button: {
                    label: "No, not now",
                    type: "listenerControl",
                    control: "declineRequest",
                    group: "mic",
                    actionType: "declineNewCandidateRequestAfterMicDropped",
                },
            },
        ],
    },
];
exports.panelSpeakerWaitingForMicAcceptance = [
    {
        id: "waiting-for-mic-acceptance",
        layout: "column",
        panelType: "speakerPanel",
        label: "Waiting for Response",
        panelStyle: "flex flex-col items-center justify-center gap-4",
        blocks: [
            {
                id: "waiting-text",
                type: "text",
                content: "⏳ Waiting for [TargetName] to decide whether to accept the mic...",
                size: "md",
                align: "center",
                textClass: "text-center text-gray-600 font-medium",
            },
        ],
    },
];
exports.panelListenersWatchingMicOffer = [
    {
        id: "others-await-offer-result",
        layout: "column",
        panelType: "statusPanel",
        label: "Mic is Being Offered",
        panelStyle: "flex flex-col items-center justify-center gap-4",
        blocks: [
            {
                id: "watching-offer-text",
                type: "text",
                content: "🎤 [TargetName] has been offered the mic and is deciding whether to speak.",
                size: "md",
                align: "center",
                textClass: "text-center text-gray-500 font-medium",
            },
        ],
    },
];
exports.testPanelListenerState17 = [
    {
        id: "listener-waiting-panel",
        layout: "column",
        panelType: "listenerSyncPanel",
        label: "Blue Select In Progress",
        blocks: [
            {
                id: "listener-waiting-text",
                type: "text",
                content: "🟦 Someone is choosing who to offer the mic to…",
                size: "md",
                align: "center",
                textClass: "text-center text-sm text-gray-500",
            },
        ],
    },
];
// State 18: Initiator picks a listener (dynamic buttons injected)
exports.testPanelListenerState18 = [
    {
        id: "choose-user-header",
        layout: "column",
        panelType: "listenerSyncPanel",
        label: "Choose a Listener",
        panelStyle: "flex flex-col items-center justify-center",
        blocks: [
            {
                id: "choose-user-instruction-text",
                type: "text",
                content: "Choose someone to offer the mic to:",
                size: "lg",
                align: "center",
                textClass: "text-center text-gray-700 font-semibold mb-4",
            },
        ],
    },
    {
        id: "choose-user-button-panel",
        layout: "row",
        panelType: "listenerSyncPanel",
        label: "Participants",
        panelStyle: "flex flex-row justify-center gap-4 flex-wrap",
        // ⬇️ actual buttons are injected dynamically in buildListenerSyncPanel
        blocks: [],
    },
];

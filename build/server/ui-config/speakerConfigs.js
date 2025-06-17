"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.panelSpeakerStateStartPassingMic = exports.panelSpeakerStateMicDropped = exports.speakerPanelWaiting = exports.speakerPanelLive = void 0;
exports.speakerPanelLive = 
// [
//   {
//     topScopeStyle: "w-full flex flex-col items-center gap-4",
//     id: "speaker-live-banner",
//     label: "Live Speaker Status", // ✅ added
//     layout: "column",
//     panelType: "statusPanel",
//     panelStyle: "flex flex-col items-center",
//     blocks: [
//       {
//         id: "live-text",
//         type: "text",
//         content: "🎤 You are LIVE!",
//         size: "lg",
//         align: "center",
//         textClass: "text-lg font-semibold text-red-600",
//       },
//     ],
//   },
// ];
[
    {
        id: "speaker-mode-panel",
        label: "Speaker Mode",
        layout: "column",
        panelType: "speakerPanel",
        blocks: [
            {
                id: "live-text",
                type: "text",
                content: "🎤 You are LIVE!",
                size: "lg",
                align: "center",
                textClass: "text-lg font-semibold text-red-600",
            },
        ],
    },
    {
        id: "speaker-mode-panel",
        label: "Speaker Mode",
        layout: "row",
        panelType: "speakerPanel",
        blocks: [
            {
                id: "button1",
                type: "button",
                //   buttonClass: "inline-block p-2",
                //   blockStyle: { border: "1px dashed #ccc" },
                buttonClass: "px-4 py-2 bg-white rounded-full border text-sm shadow hover:shadow-md transition-all hover:scale-105",
                //   iconClass: "mr-1",
                button: {
                    label: "Drop the Mic",
                    icon: "🎙️",
                    type: "speakerControl",
                    control: "dropTheMic",
                    actionType: "dropTheMic",
                    group: "mic",
                },
            },
            {
                id: "button2",
                type: "button",
                //   blockClass: "inline-block p-2",
                //   blockStyle: { border: "1px dashed #ccc" },
                buttonClass: "px-4 py-2 bg-white rounded-full border text-sm shadow hover:shadow-md transition-all hover:scale-105",
                //   iconClass: "mr-1",
                button: {
                    label: "Pass the Mic",
                    icon: "🔄",
                    type: "speakerControl",
                    control: "startPassMic",
                    actionType: "startPassMic",
                    group: "mic",
                },
            },
        ],
    },
];
exports.speakerPanelWaiting = [
    {
        topScopeStyle: "w-full flex flex-col items-center gap-4",
        id: "speaker-waiting-panel",
        label: "Waiting While Listener Thinks", // ✅ added
        layout: "column",
        panelType: "statusPanel",
        panelStyle: "flex flex-col items-center justify-center",
        blocks: [
            {
                id: "muted-text",
                type: "text",
                content: "You are muted",
                size: "xl",
                align: "center",
                style: "text-gray-700 font-bold",
            },
            {
                id: "thinking-wait-text",
                type: "text",
                content: "Please wait while the listener is thinking...",
                size: "md",
                align: "center",
                style: "text-gray-500 text-sm text-center",
            },
        ],
    },
];
exports.panelSpeakerStateMicDropped = [
    {
        id: "speaker-mic-drop-waiting",
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
exports.panelSpeakerStateStartPassingMic = [
    {
        id: "pass-mic-header",
        layout: "column",
        panelType: "speakerPanel",
        label: "Pass the Mic",
        panelStyle: "flex flex-col items-center justify-center",
        blocks: [
            {
                id: "pass-mic-instruction-text",
                type: "text",
                content: "Who do you want to invite to speak next?",
                size: "lg",
                align: "center",
                textClass: "text-center text-gray-700 font-semibold mb-4",
            },
        ],
    },
    {
        id: "pass-mic-button-panel",
        layout: "row",
        panelType: "speakerPanel",
        label: "Mic Passing Options",
        panelStyle: "flex flex-row justify-center gap-4 flex-wrap",
        blocks: [
            {
                id: "pass-to-circle-btn",
                type: "button",
                buttonClass: "px-5 py-3 rounded-full text-sm font-semibold border transition-all duration-200 bg-green-500 text-white border-green-600 hover:bg-green-600 hover:shadow-md hover:scale-105",
                button: {
                    label: "Offer Mic to the Circle",
                    icon: "🌀",
                    actionType: "dropTheMic",
                    group: "mic",
                    type: "speakerControl",
                    control: "dropTheMic",
                },
            },
            {
                id: "pass-to-specific-btn",
                type: "button",
                buttonClass: "px-5 py-3 rounded-full text-sm font-semibold border transition-all duration-200 bg-blue-500 text-white border-blue-600 hover:bg-blue-600 hover:shadow-md hover:scale-105",
                button: {
                    label: "Choose a Speaker",
                    icon: "🎯",
                    type: "speakerControl",
                    actionType: "openChooseASpeakerFromPassTheMic",
                    control: "openChooseASpeakerFromPassTheMic",
                    group: "mic",
                },
            },
        ],
    },
];

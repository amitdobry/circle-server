import { PanelConfig } from "../types/blockTypes";

// State 1: Default (no active group)
export const testPanelListenerState1: PanelConfig = [
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
        buttonClass:
          "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-700 border-gray-300 hover:bg-emerald-400 hover:text-white hover:border-emerald-500 transition",
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
        buttonClass:
          "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-700 border-gray-300 hover:bg-sky-400 hover:text-white hover:border-sky-500 transition",
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
        buttonClass:
          "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-700 border-gray-300 hover:bg-rose-400 hover:text-white hover:border-rose-500 transition",
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
export const testPanelListenerState2: PanelConfig = [
  ...testPanelListenerState1,
  {
    id: "listener-ear-semi",
    layout: "row",
    panelType: "listenerSyncPanel",
    panelStyle: "flex flex-wrap gap-2 justify-center mt-2",
    label: "sub gesture buttons",
    blocks: [
      {
        id: "ear-btn-1",
        type: "button",
        buttonClass:
          "px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 hover:bg-yellow-200 text-yellow-700",
        button: {
          label: "🤝 I feel you",
          type: "semiListenerAction",
          actionType: "feelYou",
        },
      },
      {
        id: "ear-btn-2",
        type: "button",
        buttonClass:
          "px-4 py-2 rounded-full text-sm font-medium bg-orange-100 hover:bg-orange-200 text-orange-700",
        button: {
          label: "😕 I'm confused",
          type: "semiListenerAction",
          actionType: "confused",
        },
      },
      {
        id: "ear-btn-3",
        type: "button",
        buttonClass:
          "px-4 py-2 rounded-full text-sm font-medium bg-pink-100 hover:bg-pink-200 text-pink-700",
        button: {
          label: "🙁 Not feeling it",
          type: "semiListenerAction",
          actionType: "notFeelingIt",
        },
      },
    ],
  },
];

// State 3: Brain group active
export const testPanelListenerState3: PanelConfig = [
  {
    id: "listener-main-buttons",
    layout: "row",
    panelType: "listenerSyncPanel",
    label: "main gesture buttons",
    blocks: [
      {
        id: "think-btn",
        type: "button",
        buttonClass:
          "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-700 border-gray-300 hover:bg-sky-400 hover:text-white hover:border-sky-500 transition",
        buttonClassSelected:
          "px-6 py-3 rounded-full text-base font-semibold border bg-sky-400 text-white border-sky-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300 shadow-sm transition-colors duration-150",
        button: {
          label: "🧠 Think",
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
        buttonClass:
          "px-4 py-2 rounded-full text-sm font-medium bg-blue-100 hover:bg-blue-200 text-blue-700",
        button: {
          label: "🌊 Processing",
          type: "semiListenerAction",
          actionType: "processing",
        },
      },
      {
        id: "brain-btn-2",
        type: "button",
        buttonClass:
          "px-4 py-2 rounded-full text-sm font-medium bg-purple-100 hover:bg-purple-200 text-purple-700",
        button: {
          label: "💭 Forming a thought",
          type: "semiListenerAction",
          actionType: "formingThought",
        },
      },
      {
        id: "brain-btn-3",
        type: "button",
        buttonClass:
          "px-4 py-2 rounded-full text-sm font-medium bg-indigo-100 hover:bg-indigo-200 text-indigo-700",
        button: {
          label: "⏳ Need a moment",
          type: "semiListenerAction",
          actionType: "needMoment",
        },
      },
    ],
  },
];

// State 4: Mouth group active
export const testPanelListenerState4: PanelConfig = [
  {
    id: "listener-main-buttons",
    layout: "row",
    panelType: "listenerSyncPanel",
    label: "main gesture buttons",
    blocks: [
      {
        id: "interrupt-btn",
        type: "button",
        buttonClass:
          "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-700 border-gray-300 hover:bg-rose-400 hover:text-white hover:border-rose-500 transition",
        buttonClassSelected:
          "px-6 py-3 rounded-full text-base font-semibold border bg-rose-400 text-white border-rose-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300 shadow-sm transition-colors duration-150",
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
        buttonClass:
          "px-4 py-2 rounded-full text-sm font-medium bg-yellow-100 hover:bg-yellow-200 text-yellow-700",
        button: {
          label: "➕ Add on",
          type: "semiListenerAction",
          actionType: "addOn",
        },
      },
      {
        id: "mouth-btn-2",
        type: "button",
        buttonClass:
          "px-4 py-2 rounded-full text-sm font-medium bg-purple-100 hover:bg-purple-200 text-purple-700",
        button: {
          label: "❓ Clarify",
          type: "semiListenerAction",
          actionType: "clarify",
        },
      },
      {
        id: "mouth-btn-3",
        type: "button",
        buttonClass:
          "px-4 py-2 rounded-full text-sm font-medium bg-pink-100 hover:bg-pink-200 text-pink-700",
        button: {
          label: "❌ Disagree",
          type: "semiListenerAction",
          actionType: "disagree",
        },
      },
    ],
  },
];

export const testPanelListenerState5: PanelConfig = [
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

export const testPanelListenerState6: PanelConfig = [
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
        buttonClass:
          "px-6 py-3 rounded-full text-base font-semibold border bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 transition",
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
        buttonClass:
          "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 transition",
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

export const testPanelListenerState7: PanelConfig = [
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
        buttonClass:
          "px-6 py-3 rounded-full text-base font-semibold border bg-emerald-500 text-white border-emerald-600 shadow hover:bg-emerald-600 hover:scale-105 hover:shadow-lg transition-all duration-200",
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
        buttonClass:
          "px-6 py-3 rounded-full text-base font-semibold border bg-gray-100 text-gray-600 border-gray-300 shadow hover:bg-gray-200 hover:scale-105 hover:shadow-md transition-all duration-200",
        button: {
          label: "⏳ Not Yet",
          type: "listenerControl",
          control: "declineRequest",
          group: "mic",
          actionType: "declineRequestAfterMicDropped",
        },
      },
    ],
  },
];

export const testPanelListenerState8: PanelConfig = [
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

export const testPanelListenerState9: PanelConfig = [
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

export const testPanelListenerState10: PanelConfig = [
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

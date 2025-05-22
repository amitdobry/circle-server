import { PanelConfig } from "../types/blockTypes";

export const speakerPanelLive: PanelConfig =
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
          buttonClass:
            "px-4 py-2 bg-white rounded-full border text-sm shadow hover:shadow-md transition-all hover:scale-105",
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
          buttonClass:
            "px-4 py-2 bg-white rounded-full border text-sm shadow hover:shadow-md transition-all hover:scale-105",
          //   iconClass: "mr-1",
          button: {
            label: "Pass the Mic",
            icon: "🔄",
            type: "speakerControl",
            control: "passMic",
            actionType: "passMic",
            group: "mic",
          },
        },
      ],
    },
  ];

export const speakerPanelWaiting: PanelConfig = [
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

export const panelSpeakerStateMicDropped: PanelConfig = [
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

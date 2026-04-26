import { PanelContext } from "../panelConfigService";
import { PanelConfig } from "../types/blockTypes";

/**
 * Build Waiting Panel - shown when only 1 user in room
 * This is the WAITING_FOR_USERS state
 */
export function buildWaitingPanel(ctx: PanelContext): PanelConfig {
  return [
    {
      id: "waiting-header",
      layout: "column",
      panelType: "waiting",
      label: "",
      blocks: [
        {
          id: "waiting-title",
          type: "text",
          content: "Welcome to the Circle",
          size: "2xl",
          align: "center",
          style: "text-black font-bold",
          textClass: "text-2xl font-bold text-center mb-4",
        },
        {
          id: "waiting-message",
          type: "text",
          content: "⏳ Waiting for others to join...",
          size: "xl",
          align: "center",
          style: "text-gray-500 italic",
          textClass: "text-xl text-gray-500 italic text-center mb-6",
        },
        {
          id: "waiting-instruction",
          type: "text",
          content:
            "The circle will begin when more people arrive. You can share the link to invite others.",
          size: "base",
          align: "center",
          style: "text-gray-600",
          textClass: "text-base text-gray-600 text-center max-w-md mx-auto",
        },
      ],
    },
  ];
}

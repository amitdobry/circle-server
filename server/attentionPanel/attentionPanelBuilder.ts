import { PanelContext } from "../panelConfigService";
import { PanelConfig, AttentionButtonBlock } from "../types/blockTypes";
import { attentionCatalog } from "../ui-config/attentionCatalog";

export function buildAttentionPanel(ctx: PanelContext): PanelConfig {
  const others = ctx.participantNames.filter((name) => name !== ctx.userName);

  const participantButtons: AttentionButtonBlock[] = others.map(
    (name, index) => {
      const attention = attentionCatalog["attend-001"];
      return {
        id: `participant-btn-${index}`,
        type: "button",
        // panelType: "attentionPanel",
        buttonClass:
          "px-6 py-2 rounded-full text-sm font-semibold transition-all border bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200",
        button: {
          label: name,
          // attentionCode: attention.code,
          // color: attention.color,
          // tailwind: attention.tailwind,
          type: "attentionTarget",
          actionType: attention.actionType,
          targetUser: name,
        },
      };
    }
  );

  // ✨ Ready to Glow button
  const glowAttention = attentionCatalog["raise-hand"];
  const glowButton: AttentionButtonBlock = {
    id: "ready-to-glow",
    type: "button",
    buttonClass:
      "px-6 py-3 rounded-full text-base font-semibold border transition-all duration-200 bg-indigo-400 text-white border-indigo-500 hover:bg-indigo-500 hover:shadow-md hover:scale-105 w-full sm:w-auto",
    // panelType: "attentionPanel",
    button: {
      label: glowAttention.label,
      // attentionCode: glowAttention.code,
      // color: glowAttention.color,
      // tailwind: glowAttention.tailwind,
      type: "attentionTarget",
      actionType: glowAttention.actionType,
      targetUser: ctx.userName,
    },
  };

  // Hide button (client can wire it to toggle visibility)
  const hideAttention = attentionCatalog["hide-panel"];
  // const hideButton: AttentionButtonBlock = {
  //   id: "hide-panel",
  //   type: "button",
  //   panelType: "attentionPanel",
  //   button: {
  //     label: hideAttention.label,
  //     attentionCode: hideAttention.code,
  //     color: hideAttention.color,
  //     tailwind: hideAttention.tailwind,
  //     actionType: hideAttention.actionType,
  //   },
  // };

  return [
    {
      id: "attention-glow",
      layout: "row",
      panelType: "attentionPanel",
      panelStyle: "",
      label: "Choose one to listen to",
      blocks: [glowButton],
    },
    {
      id: "attention-text",
      layout: "row",
      panelType: "attentionPanel",
      panelStyle: "",
      label: "",
      blocks: [
        {
          id: "attention-instruction-text",
          type: "text",
          content: "Choose one to listen to. When all align, a voice is born.",
          size: "xl",
          align: "center",
          style: "text-black-500 font-semibold",
          textClass: "mt-1 mb-1 text-sm text-gray-500 text-center max-w-sm",
        },
      ],
    },
    {
      id: "attention-panel",
      label: "Choose one to listen to",
      layout: "row",
      panelType: "attentionPanel",
      panelStyle: "flex flex-wrap gap-2 justify-center w-full max-w-md",
      // topScopeStyle: "bg-white/70 p-6 rounded-lg shadow-xl", // 🌟 << added here
      blocks: [...participantButtons],
    },
  ];
}

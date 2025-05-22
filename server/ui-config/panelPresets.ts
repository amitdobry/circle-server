export const PanelCovers: PanelMeta[] = [
  {
    id: "attentionPanel",
    label: "Choose one to listen to",
    layout: "row",
  },
  {
    id: "pausePanel",
    label: "You're thinking...",
    layout: "column",
  },
];

// somewhere global, e.g., blockTypes.ts

export interface PanelMeta {
  id: string;
  label: string;
  layout: "row" | "column"; // or use `PanelLayout` if already defined
}

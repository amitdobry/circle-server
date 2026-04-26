// server/types/blockTypes.ts

export type PanelSection = {
  id: string;
  label: string;
  layout: PanelLayout;
  panelType: string;
  panelStyle?: string;
  topScopeStyle?: string; // 👈 new: top-scope "container" style
  blocks: PanelBlock[];
};

export type PanelConfig = PanelSection[];

export type PanelLayout = "row" | "column";

export type PanelBlock =
  | EmojiBlock
  | TextBlock
  | SpacerBlock
  | AttentionButtonBlock
  | GestureButtonConfig
  | ListenerButtonBlock
  | SubjectSelectionBlock // 🆕 Content Phase Feature
  | RoundDisplayBlock; // 🆕 Round UI Feature

export type EmojiBlock = {
  id: string;
  type: "emoji";
  emoji: string;
  size: number;
  content?: string;
  button?: any;
};

export type TextBlock = {
  id: string;
  type: "text";
  content: string;
  size: string;
  align: string;
  style?: string;
  textClass?: string;
};

export type SpacerBlock = {
  id: string;
  type: "spacer";
  height: number;
  content?: string;
};

export type ListenerButtonBlock = {
  id: string;
  type: "button";
  buttonClass: string;
  buttonClassSelected?: string;
  button: ListenerButtonConfig;
  content?: string;
};

export type ListenerButtonConfig = {
  label: string;
  type: "listenerAction" | "semiListenerAction";
  actionType: string;
  group?: string;
  icon?: string;
  state?: string;
  targetUser?: string;
};

export type GestureButtonBlock = {
  id: string;
  type: "button";
  attentionCode: string;
  button: GestureButtonConfig;
};

export type GestureButtonConfig = {
  id: string;
  content: string;
  label: string; // e.g. "I'm confused"
  actionType: string; // "pickGesture"
  gestureCode: string; // "002" etc
  group: "ear" | "brain" | "mouth";
  icon: string; // e.g. "🤔"
  control: "gesturePicking"; // used in emit
  type: string;
};

export type AttentionButtonBlock = {
  id: string;
  buttonClass: string;
  type: "button";
  button: AttentionButtonConfig;
  content?: string;
};

export type AttentionButtonConfig = {
  label: string;
  attentionCode?: string;
  color?: string;
  tailwind?: string;
  actionType: string;
  targetUser?: string;
  style?: string;
  textClass?: string;
  type?: string;
  group?: string;
  control?: string; // ✅ Add this line
  icon?: string;
  state?: string;
  flavor?: string; // Optional flavor for special buttons
};

// 🆕 Content Phase Feature
export type SubjectSelectionBlock = {
  id?: string;
  type: "subjectSelection";
  subjects: Array<{
    key: string;
    label: string;
    description: string;
  }>;
  selectedSubject: string | null;
  hasVoted: boolean;
};

// 🆕 Round Display Feature (Glyph + Readiness)
export type RoundDisplayBlock = {
  id: string;
  type: "roundDisplay";
  roundNumber: number;
  glyphText: string;
  subjectKey: string;
  userIsReady: boolean;
  readyCount: number;
  totalCount: number;
};

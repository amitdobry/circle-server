import { Gesture } from "./Gestures";

export const gestureCatalog = {
  ear: {
    "001": new Gesture("001", "I feel you", "🤝", "emerald"),
    "002": new Gesture("002", "I'm confused", "🤔", "amber"),
    "003": new Gesture("003", "Not feeling it", "😕", "rose"),
  },
  brain: {
    "101": new Gesture("101", "Processing", "🔄", "blue"),
    "102": new Gesture("102", "Forming a thought", "💭", "sky"),
    "103": new Gesture("103", "Need a moment", "🕰️", "indigo"),
  },
  mouth: {
    "201": new Gesture("201", "Add on", "➕", "orange"),
    "202": new Gesture("202", "Clarify", "❓", "violet"),
    "203": new Gesture("203", "Disagree", "✖️", "rose"),
  },
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gestureCatalog = void 0;
const Gestures_1 = require("./Gestures");
exports.gestureCatalog = {
    ear: {
        "001": new Gestures_1.Gesture("001", "I feel you", "🤝", "emerald"),
        "002": new Gestures_1.Gesture("002", "I'm confused", "🤔", "amber"),
        "003": new Gestures_1.Gesture("003", "Not feeling it", "😕", "rose"),
    },
    brain: {
        "101": new Gestures_1.Gesture("101", "Processing", "🔄", "blue"),
        "102": new Gestures_1.Gesture("102", "Forming a thought", "💭", "sky"),
        "103": new Gestures_1.Gesture("103", "Need a moment", "🕰️", "indigo"),
    },
    mouth: {
        "201": new Gestures_1.Gesture("201", "Add on", "➕", "orange"),
        "202": new Gestures_1.Gesture("202", "Clarify", "❓", "violet"),
        "203": new Gestures_1.Gesture("203", "Disagree", "✖️", "rose"),
    },
};

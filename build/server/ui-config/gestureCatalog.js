"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gestureCatalog = void 0;
const Gestures_1 = require("./Gestures");
exports.gestureCatalog = {
    ear: {
        "001": new Gestures_1.Gesture("001", "I feel you", "🤝", "emerald", "px-4 py-2 rounded-full text-sm bg-emerald-100 text-emerald-700 border border-emerald-300 transition-all duration-200 hover:brightness-110 hover:shadow-md hover:scale-105", "syncedGesture"),
        "002": new Gestures_1.Gesture("002", "I'm confused", "🤔", "amber", "px-4 py-2 rounded-full text-sm bg-amber-100 text-amber-700 border border-amber-300 transition-all duration-200 hover:brightness-110 hover:shadow-md hover:scale-105", "syncedGesture"),
        "003": new Gestures_1.Gesture("003", "Not feeling it", "😕", "rose", "px-4 py-2 rounded-full text-sm bg-rose-100 text-rose-700 border border-rose-300 transition-all duration-200 hover:brightness-110 hover:shadow-md hover:scale-105", "syncedGesture"),
    },
    brain: {
        "101": new Gestures_1.Gesture("101", "Processing", "🔄", "blue", "px-4 py-2 rounded-full text-sm bg-blue-100 text-blue-700 border border-blue-300 transition-all duration-200 hover:brightness-110 hover:shadow-md hover:scale-105", "syncedGesture"),
        "102": new Gestures_1.Gesture("102", "Forming a thought", "💭", "sky", "px-4 py-2 rounded-full text-sm bg-sky-100 text-sky-700 border border-sky-300 transition-all duration-200 hover:brightness-110 hover:shadow-md hover:scale-105", "syncedGesture"),
        "103": new Gestures_1.Gesture("103", "Need a moment", "🕰️", "indigo", "px-4 py-2 rounded-full text-sm bg-indigo-100 text-indigo-700 border border-indigo-300 transition-all duration-200 hover:brightness-110 hover:shadow-md hover:scale-105", "breakSync"),
    },
    mouth: {
        "201": new Gestures_1.Gesture("201", "Add on", "➕", "orange", "px-4 py-2 rounded-full text-sm bg-orange-100 text-orange-700 border border-orange-300 transition-all duration-200 hover:brightness-110 hover:shadow-md hover:scale-105", "breakSync"),
        "202": new Gestures_1.Gesture("202", "Clarify", "❓", "violet", "px-4 py-2 rounded-full text-sm bg-violet-100 text-violet-700 border border-violet-300 transition-all duration-200 hover:brightness-110 hover:shadow-md hover:scale-105", "breakSync"),
        "203": new Gestures_1.Gesture("203", "Disagree", "✖️", "rose", "px-4 py-2 rounded-full text-sm bg-rose-200 text-rose-700 border border-rose-300 transition-all duration-200 hover:brightness-110 hover:shadow-md hover:scale-105", "breakSync"),
    },
};

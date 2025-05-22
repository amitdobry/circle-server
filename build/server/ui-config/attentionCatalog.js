"use strict";
// server/ui-config/attentionCatalog.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.attentionCatalog = void 0;
const Attentions_1 = require("./Attentions");
exports.attentionCatalog = {
    "attend-001": new Attentions_1.Attention("attend-001", "Point at user", "emerald", "px-4 py-2 rounded-full text-sm font-semibold transition-all border bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200", "point"),
    "raise-hand": new Attentions_1.Attention("raise-hand", "✨ Ready to Glow", "indigo", "px-6 py-3 rounded-full text-base font-semibold border transition-all duration-200 bg-indigo-400 text-white border-indigo-500 hover:bg-indigo-500 hover:shadow-md hover:scale-105", "raiseHand"),
    "hide-panel": new Attentions_1.Attention("hide-panel", "Hide", "rose", "px-3 py-1 text-xs bg-rose-100 text-rose-500 rounded-full border border-rose-200", "hidePanel"),
};

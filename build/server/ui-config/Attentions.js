"use strict";
// server/ui-config/Attentions.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.Attention = void 0;
class Attention {
    constructor(code, label, color, tailwind, actionType) {
        this.code = code;
        this.label = label;
        this.color = color;
        this.tailwind = tailwind;
        this.actionType = actionType;
    }
    getBroadcastPayload(from) {
        return {
            from,
            type: "attention",
            attentionCode: this.code,
            label: this.label,
            color: this.color,
            tailwind: this.tailwind,
            actionType: this.actionType,
        };
    }
    getUIButtonConfig() {
        return {
            label: this.label,
            attentionCode: this.code,
            color: this.color,
            tailwind: this.tailwind,
            actionType: this.actionType,
        };
    }
}
exports.Attention = Attention;

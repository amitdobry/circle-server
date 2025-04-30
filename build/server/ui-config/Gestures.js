"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gesture = void 0;
class Gesture {
    constructor(code, label, emoji, color, tailwind, actionType) {
        this.code = code;
        this.label = label;
        this.emoji = emoji;
        this.color = color;
        this.tailwind = tailwind; // 💥 New!
        this.actionType = actionType;
    }
    getBroadcastPayload(from) {
        return {
            from,
            type: "gesture",
            gestureCode: this.code,
            label: this.label,
            emoji: this.emoji,
            color: this.color,
            tailwind: this.tailwind,
            actionType: this.actionType,
        };
    }
    triggerEffect() {
        console.log(`🎆 Trigger effect: ${this.label}`);
    }
    getUIButtonConfig(type) {
        return {
            type,
            subType: this.code,
            label: this.label,
            emoji: this.emoji,
            color: this.color,
            tailwind: this.tailwind,
            actionType: this.actionType,
        };
    }
}
exports.Gesture = Gesture;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gesture = void 0;
class Gesture {
    constructor(code, label, emoji, color) {
        this.code = code;
        this.label = label;
        this.emoji = emoji;
        this.color = color;
    }
    getBroadcastPayload(from) {
        return {
            from,
            type: "gesture",
            gestureCode: this.code,
            label: this.label,
            emoji: this.emoji,
            color: this.color,
        };
    }
    triggerEffect() {
        console.log(`🎆 Trigger effect: ${this.label}`);
    }
}
exports.Gesture = Gesture;

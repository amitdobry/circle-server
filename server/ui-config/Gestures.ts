export class Gesture {
  code: string;
  label: string;
  emoji: string;
  color: string;

  constructor(code: string, label: string, emoji: string, color: string) {
    this.code = code;
    this.label = label;
    this.emoji = emoji;
    this.color = color;
  }

  getBroadcastPayload(from: string) {
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

export class Gesture {
  code: string;
  label: string;
  emoji: string;
  color: string;
  tailwind: string;
  actionType: string | undefined;

  constructor(
    code: string,
    label: string,
    emoji: string,
    color: string,
    tailwind: string,
    actionType: string
  ) {
    this.code = code;
    this.label = label;
    this.emoji = emoji;
    this.color = color;
    this.tailwind = tailwind; // 💥 New!
    this.actionType = actionType;
  }

  getBroadcastPayload(from: string) {
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

  getUIButtonConfig(type: "ear" | "brain" | "mouth") {
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

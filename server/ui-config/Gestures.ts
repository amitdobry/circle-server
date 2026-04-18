import { Server } from "socket.io";
import { GliffMessage, createGliffLog } from "../gliffLogService";

export class Gesture {
  code: string;
  label: string;
  emoji: string;
  color: string;
  tailwind: string;
  actionType: string | undefined;
  flavor?: string; // Optional flavor for special gestures

  constructor(
    code: string,
    label: string,
    emoji: string,
    color: string,
    tailwind: string,
    actionType: string,
    flavor?: string
  ) {
    this.code = code;
    this.label = label;
    this.emoji = emoji;
    this.color = color;
    this.tailwind = tailwind; // 💥 New!
    this.actionType = actionType;
    this.flavor = flavor;
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
      flavor: this.flavor, // Include flavor if it exists
    };
  }

  triggerEffect(io: Server, userName = "", roomId = "default-room") {
    const message: GliffMessage = {
      userName,
      message: {
        messageType: "gesture",
        content: this.label,
        emoji: this.emoji,
        timestamp: Date.now(),
      },
    };
    createGliffLog(message, io, roomId);
    console.log(`🎆 [Room ${roomId}] Trigger effect: ${this.label}`);
  }

  getUIButtonConfig(type: "ear" | "brain" | "mouth" | "mic" | "blue") {
    return {
      type,
      subType: this.code,
      label: this.label,
      emoji: this.emoji,
      color: this.color,
      tailwind: this.tailwind,
      actionType: this.actionType,
      flavor: this.flavor,
    };
  }
}

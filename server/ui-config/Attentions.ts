// server/ui-config/Attentions.ts

export class Attention {
  code: string;
  label: string;
  color: string;
  tailwind: string;
  actionType: string;

  constructor(
    code: string,
    label: string,
    color: string,
    tailwind: string,
    actionType: string
  ) {
    this.code = code;
    this.label = label;
    this.color = color;
    this.tailwind = tailwind;
    this.actionType = actionType;
  }

  getBroadcastPayload(from: string) {
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

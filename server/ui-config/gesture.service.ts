import { gestureCatalog } from "./gestureCatalog";
import { Gesture } from "./Gestures";

export function getAllGestureButtons() {
  const buttons: Record<
    "ear" | "brain" | "mouth",
    ReturnType<Gesture["getUIButtonConfig"]>[]
  > = {
    ear: [],
    brain: [],
    mouth: [],
  };

  for (const type of ["ear", "brain", "mouth"] as const) {
    const gestures = gestureCatalog[type] as Record<string, Gesture>;

    for (const key of Object.keys(gestures)) {
      buttons[type].push(gestures[key].getUIButtonConfig(type));
    }
  }

  return buttons;
}

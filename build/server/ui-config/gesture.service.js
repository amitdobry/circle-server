"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllGestureButtons = getAllGestureButtons;
const gestureCatalog_1 = require("./gestureCatalog");
function getAllGestureButtons() {
    const buttons = {
        ear: [],
        brain: [],
        mouth: [],
    };
    for (const type of ["ear", "brain", "mouth"]) {
        const gestures = gestureCatalog_1.gestureCatalog[type];
        for (const key of Object.keys(gestures)) {
            buttons[type].push(gestures[key].getUIButtonConfig(type));
        }
    }
    return buttons;
}

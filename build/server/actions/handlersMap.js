"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlersMap = void 0;
const handleSyncedGesture_1 = require("./handlers/handleSyncedGesture");
const handleBreakSync_1 = require("./handlers/handleBreakSync");
const handlePauseForThought_1 = require("./handlers/handlePauseForThought");
const handlePointAtSpeaker_1 = require("./handlers/handlePointAtSpeaker");
exports.handlersMap = {
    handleSyncedGesture: handleSyncedGesture_1.handleSyncedGesture,
    handleBreakSync: handleBreakSync_1.handleBreakSync,
    handlePauseForThought: handlePauseForThought_1.handlePauseForThought,
    handlePointAtSpeaker: handlePointAtSpeaker_1.handlePointAtSpeaker,
};

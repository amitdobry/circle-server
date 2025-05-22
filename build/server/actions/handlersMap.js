"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlersMap = void 0;
const handleSyncedGesture_1 = require("./handlers/handleSyncedGesture");
const handleBreakSync_1 = require("./handlers/handleBreakSync");
const handlePauseForThought_1 = require("./handlers/handlePauseForThought");
const handlePointAtSpeaker_1 = require("./handlers/handlePointAtSpeaker");
const handleSelectMouth_1 = require("./handlers/handleSelectMouth");
const handleUnSelectMouth_1 = require("./handlers/handleUnSelectMouth");
const handleSelectBrain_1 = require("./handlers/handleSelectBrain");
const handleUnSelectBrain_1 = require("./handlers/handleUnSelectBrain");
const handleDropTheMic_1 = require("./handlers/handleDropTheMic");
const handleWishToSpeakAfterMicDropped_1 = require("./handlers/handleWishToSpeakAfterMicDropped");
const handleDeclineToSpeakAfterMicDropped_ts_1 = require("./handlers/handleDeclineToSpeakAfterMicDropped.ts");
exports.handlersMap = {
    handleSyncedGesture: handleSyncedGesture_1.handleSyncedGesture,
    handleBreakSync: handleBreakSync_1.handleBreakSync,
    handlePauseForThought: handlePauseForThought_1.handlePauseForThought,
    handlePointAtSpeaker: handlePointAtSpeaker_1.handlePointAtSpeaker,
    handleSelectMouth: handleSelectMouth_1.handleSelectMouth,
    handleUnselectMouth: handleUnSelectMouth_1.handleUnselectMouth,
    handleSelectBrain: handleSelectBrain_1.handleSelectBrain,
    handleUnSelectBrain: handleUnSelectBrain_1.handleUnSelectBrain,
    handleDropTheMic: handleDropTheMic_1.handleDropTheMic,
    handleWishToSpeakAfterMicDropped: handleWishToSpeakAfterMicDropped_1.handleWishToSpeakAfterMicDropped,
    handleDeclineToSpeakAfterMicDropped: handleDeclineToSpeakAfterMicDropped_ts_1.handleDeclineToSpeakAfterMicDropped,
};

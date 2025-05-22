"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = [
    {
        actionType: "syncedGesture",
        type: "ear",
        handler: "handleSyncedGesture",
    },
    {
        actionType: "breakSync",
        type: "mouth",
        handler: "handleBreakSync",
    },
    {
        actionType: "pauseForThought",
        type: "brain",
        handler: "handlePauseForThought",
    },
    {
        actionType: "pointAtSpeaker",
        type: "pointing",
        handler: "handlePointAtSpeaker",
    },
    {
        actionType: "selectMouth",
        type: "mouth",
        handler: "handleSelectMouth",
    },
    {
        actionType: "unSelectMouth",
        type: "mouth",
        handler: "handleUnselectMouth",
    },
    {
        actionType: "selectBrain",
        type: "brain",
        handler: "handleSelectBrain",
    },
    {
        actionType: "unSelectBrain",
        type: "brain",
        handler: "handleUnSelectBrain",
    },
    {
        actionType: "dropTheMic",
        type: "mic",
        handler: "handleDropTheMic",
    },
    {
        actionType: "wishToSpeakAfterMicDropped",
        type: "mic",
        handler: "handleWishToSpeakAfterMicDropped",
    },
    {
        actionType: "declineRequestAfterMicDropped",
        type: "mic",
        handler: "handleDeclineToSpeak",
    },
];

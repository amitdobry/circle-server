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
const handlePassTheMic_1 = require("./handlers/handlePassTheMic");
const handleWishToSpeakAfterMicDropped_1 = require("./handlers/handleWishToSpeakAfterMicDropped");
const handleDeclineToSpeakAfterMicDropped_1 = require("./handlers/handleDeclineToSpeakAfterMicDropped");
const handleconcentNewSpeakerFromMicDropped_1 = require("./handlers/handleconcentNewSpeakerFromMicDropped");
const handleDeclineNewCandidateRequestAfterMicDropped_1 = require("./handlers/handleDeclineNewCandidateRequestAfterMicDropped");
const handleOpenChooseASpeakerFromPassTheMic_1 = require("./handlers/handleOpenChooseASpeakerFromPassTheMic");
const handleOfferMicToUserFromPassTheMic_1 = require("./handlers/handleOfferMicToUserFromPassTheMic");
const handleAcceptMicOfferFromPassTheMic_1 = require("./handlers/handleAcceptMicOfferFromPassTheMic");
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
    handlePassTheMic: handlePassTheMic_1.handlePassTheMic,
    handleWishToSpeakAfterMicDropped: handleWishToSpeakAfterMicDropped_1.handleWishToSpeakAfterMicDropped,
    handleDeclineToSpeakAfterMicDropped: handleDeclineToSpeakAfterMicDropped_1.handleDeclineToSpeakAfterMicDropped,
    handleConcentNewSpeakerFromMicDropped: handleconcentNewSpeakerFromMicDropped_1.handleConcentNewSpeakerFromMicDropped,
    handleDeclineNewCandidateRequestAfterMicDropped: handleDeclineNewCandidateRequestAfterMicDropped_1.handleDeclineNewCandidateRequestAfterMicDropped,
    handleOpenChooseASpeakerFromPassTheMic: handleOpenChooseASpeakerFromPassTheMic_1.handleOpenChooseASpeakerFromPassTheMic,
    handleOfferMicToUserFromPassTheMic: handleOfferMicToUserFromPassTheMic_1.handleOfferMicToUserFromPassTheMic,
    handleAcceptMicOfferFromPassTheMic: handleAcceptMicOfferFromPassTheMic_1.handleAcceptMicOfferFromPassTheMic,
};

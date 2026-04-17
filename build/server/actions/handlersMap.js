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
const handleSelectEar_1 = require("./handlers/handleSelectEar");
const handleUnSelectBrain_1 = require("./handlers/handleUnSelectBrain");
const handleDropTheMic_1 = require("./handlers/handleDropTheMic");
const handlePassTheMic_1 = require("./handlers/handlePassTheMic");
const handleWishToSpeakAfterMicDropped_1 = require("./handlers/handleWishToSpeakAfterMicDropped");
const handleDeclineToSpeakAfterMicDropped_1 = require("./handlers/handleDeclineToSpeakAfterMicDropped");
const handleConcentNewSpeakerFromMicDroppedState_1 = require("./handlers/handleConcentNewSpeakerFromMicDroppedState");
const handleDeclineNewCandidateRequestAfterMicDropped_1 = require("./handlers/handleDeclineNewCandidateRequestAfterMicDropped");
const handleOpenChooseASpeakerFromPassTheMic_1 = require("./handlers/handleOpenChooseASpeakerFromPassTheMic");
const handleOfferMicToUserFromPassTheMic_1 = require("./handlers/handleOfferMicToUserFromPassTheMic");
const handleAcceptMicOfferFromPassTheMic_1 = require("./handlers/handleAcceptMicOfferFromPassTheMic");
const handleUnSelectEar_1 = require("./handlers/handleUnSelectEar");
const handleDisagree_1 = require("./handlers/handleDisagree");
const handleBlueSelectStart_1 = require("./handlers/handleBlueSelectStart");
const handleBluePersonChosen_1 = require("./handlers/handleBluePersonChosen");
const handleEarBlueSelectStart_1 = require("./handlers/handleEarBlueSelectStart");
const handleEarBluePersonChosen_1 = require("./handlers/handleEarBluePersonChosen");
exports.handlersMap = {
    handleSyncedGesture: handleSyncedGesture_1.handleSyncedGesture,
    handleBreakSync: handleBreakSync_1.handleBreakSync,
    handlePauseForThought: handlePauseForThought_1.handlePauseForThought,
    handlePointAtSpeaker: handlePointAtSpeaker_1.handlePointAtSpeaker,
    handleSelectMouth: handleSelectMouth_1.handleSelectMouth,
    handleUnselectMouth: handleUnSelectMouth_1.handleUnselectMouth,
    handleSelectBrain: handleSelectBrain_1.handleSelectBrain,
    handleUnSelectBrain: handleUnSelectBrain_1.handleUnSelectBrain,
    handleSelectEar: handleSelectEar_1.handleSelectEar,
    handleUnSelectEar: handleUnSelectEar_1.handleUnSelectEar,
    handleDropTheMic: handleDropTheMic_1.handleDropTheMic,
    handlePassTheMic: handlePassTheMic_1.handlePassTheMic,
    handleWishToSpeakAfterMicDropped: handleWishToSpeakAfterMicDropped_1.handleWishToSpeakAfterMicDropped,
    handleDeclineToSpeakAfterMicDropped: handleDeclineToSpeakAfterMicDropped_1.handleDeclineToSpeakAfterMicDropped,
    handleConcentNewSpeakerFromMicDropped: handleConcentNewSpeakerFromMicDroppedState_1.handleConcentNewSpeakerFromMicDropped,
    handleDeclineNewCandidateRequestAfterMicDropped: handleDeclineNewCandidateRequestAfterMicDropped_1.handleDeclineNewCandidateRequestAfterMicDropped,
    handleOpenChooseASpeakerFromPassTheMic: handleOpenChooseASpeakerFromPassTheMic_1.handleOpenChooseASpeakerFromPassTheMic,
    handleOfferMicToUserFromPassTheMic: handleOfferMicToUserFromPassTheMic_1.handleOfferMicToUserFromPassTheMic,
    handleAcceptMicOfferFromPassTheMic: handleAcceptMicOfferFromPassTheMic_1.handleAcceptMicOfferFromPassTheMic,
    handleDisagree: handleDisagree_1.handleDisagree,
    // 🌊 Blue handlers
    handleBlueSelectStart: handleBlueSelectStart_1.handleBlueSelectStart,
    handleBluePersonChosen: handleBluePersonChosen_1.handleBluePersonChosen,
    handleEarBlueSelectStart: handleEarBlueSelectStart_1.handleEarBlueSelectStart,
    handleEarBluePersonChosen: handleEarBluePersonChosen_1.handleEarBluePersonChosen,
};

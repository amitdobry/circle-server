export const config = [
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
    actionType: "startPassMic",
    type: "mic",
    handler: "handlePassTheMic",
  },
  {
    actionType: "wishToSpeakAfterMicDropped",
    type: "mic",
    handler: "handleWishToSpeakAfterMicDropped",
  },
  {
    actionType: "declineRequestAfterMicDropped",
    type: "mic",
    handler: "handleDeclineToSpeakAfterMicDropped",
  },
  {
    actionType: "declineNewCandidateRequestAfterMicDropped",
    type: "mic",
    handler: "handleDeclineNewCandidateRequestAfterMicDropped",
  },
  {
    actionType: "concentNewSpeakerFromMicDropped",
    type: "mic",
    handler: "handleConcentNewSpeakerFromMicDropped",
  },
  {
    actionType: "openChooseASpeakerFromPassTheMic",
    type: "mic",
    handler: "handleOpenChooseASpeakerFromPassTheMic",
  },
  {
    actionType: "offerMicToUserFromPassTheMic",
    type: "mic",
    handler: "handleOfferMicToUserFromPassTheMic",
  },
  {
    actionType: "acceptMicOfferFromPassTheMic",
    type: "mic",
    handler: "handleAcceptMicOfferFromPassTheMic",
  },
];

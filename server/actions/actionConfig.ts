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
];

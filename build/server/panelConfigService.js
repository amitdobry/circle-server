"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectPanelContext = collectPanelContext;
exports.getPanelConfigFor = getPanelConfigFor;
const socketHandler_1 = require("./socketHandler");
const panelBuilderRouter_1 = require("./panelBuilderRouter");
function collectPanelContext(userName) {
    const allUsers = (0, socketHandler_1.getUsers)(); // full Map<string, UserInfo>
    const participantList = Array.from((0, socketHandler_1.getUsers)().values()).map((u) => u.name);
    const userIsParticipant = participantList.includes(userName);
    const currentLiveSpeaker = (0, socketHandler_1.getLiveSpeaker)();
    const currentPointerMap = (0, socketHandler_1.getPointerMap)();
    return {
        userName,
        userIsParticipant,
        // wasInterruptedBy: interruptingUser,
        liveSpeaker: currentLiveSpeaker,
        isUserSpeaker: currentLiveSpeaker === userName,
        totalParticipants: participantList.length,
        participantNames: participantList,
        pointerMap: currentPointerMap,
        allUsers,
    };
}
function getPanelConfigFor(userName) {
    const context = collectPanelContext(userName);
    return (0, panelBuilderRouter_1.panelBuilderRouter)(context);
}

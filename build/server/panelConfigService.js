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
    const isSyncPauseMode = (0, socketHandler_1.getIsSyncPauseMode)();
    return {
        userName,
        userIsParticipant,
        // wasInterruptedBy: interruptingUser,
        liveSpeaker: currentLiveSpeaker,
        isUserSpeaker: currentLiveSpeaker === userName,
        isSyncPauseMode: isSyncPauseMode,
        totalParticipants: participantList.length,
        participantNames: participantList,
        pointerMap: currentPointerMap,
        allUsers,
    };
}
function getPanelConfigFor(userName) {
    const context = collectPanelContext(userName);
    const user = Array.from(context.allUsers.values()).find((u) => u.name === userName);
    if (user) {
        console.log(`📦 Preparing panel at panelConfigService for ${user.name} → ${user.state}`);
    }
    else {
        console.warn(`⚠️ No user found in context for ${userName}`);
    }
    return (0, panelBuilderRouter_1.panelBuilderRouter)(context);
}

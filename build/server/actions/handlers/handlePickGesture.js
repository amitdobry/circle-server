"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePickGesture = handlePickGesture;
const routeAction_1 = require("../routeAction");
const panelConfigService_1 = require("../../panelConfigService");
function handlePickGesture(payload, context) {
    const { name, subType } = payload;
    const { users, io, logAction, logSystem, roomId } = context;
    if (!name || !subType) {
        logSystem("🚨 Missing name or subType in pickGesture payload");
        return;
    }
    logAction(`🎯 ${name} picked gesture: ${subType}`);
    // Phase E: Filter users to only this room
    const roomUsers = (0, routeAction_1.filterUsersByRoom)(users, roomId, io);
    // Find user and attach subgesture info
    const userEntry = Array.from(roomUsers.entries()).find(([, u]) => u.name === name);
    if (!userEntry) {
        logSystem(`⚠️ Could not find user: ${name}`);
        return;
    }
    const [socketId, user] = userEntry;
    // Update user state (you could make a dedicated subfield if needed)
    user.state = `gesture:${subType}`; // or attach `user.gesture = subType`
    users.set(socketId, user);
    // Emit updated config to the user only
    const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
    io.to(socketId).emit("receive:panelConfig", config);
}

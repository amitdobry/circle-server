"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeAction = routeAction;
exports.filterUsersByRoom = filterUsersByRoom;
const actionConfig_1 = require("./actionConfig");
const handlersMap_1 = require("./handlersMap"); // we'll set this up
/**
 * Phase E: Helper to filter users to only those in the specified room
 * @param users - Global users Map
 * @param roomId - Room ID to filter by
 * @param io - Socket.IO server instance (to check socket.data.roomId)
 * @returns Map of users only in the specified room
 */
function filterUsersByRoom(users, roomId, io) {
    const roomUsers = new Map();
    for (const [socketId, user] of users.entries()) {
        const socket = io.sockets.sockets.get(socketId);
        const socketRoomId = socket?.data?.roomId || socket?.data?.tableId;
        if (socketRoomId === roomId) {
            roomUsers.set(socketId, user);
        }
    }
    return roomUsers;
}
function routeAction(payload, context) {
    const { actionType, type } = payload;
    const match = actionConfig_1.config.find((entry) => entry.actionType === actionType && (!entry.type || entry.type === type));
    if (!match) {
        console.warn("[Router] ❌ No matching handler found for:", payload);
        return;
    }
    const handler = handlersMap_1.handlersMap[match.handler];
    if (!handler) {
        console.warn(`[Router] ❌ Handler not implemented: ${match.handler}`);
        return;
    }
    handler(payload, context);
}

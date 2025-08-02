"use strict";
// sessionLogic.ts - Session Management Business Logic
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSimpleSessionStats = getSimpleSessionStats;
exports.formatSessionLog = formatSessionLog;
exports.updateUserActivity = updateUserActivity;
exports.addUser = addUser;
exports.addTableUser = addTableUser;
exports.removeUser = removeUser;
exports.getUser = getUser;
exports.getUsers = getUsers;
exports.getTableUsers = getTableUsers;
exports.getSessionStats = getSessionStats;
// Session state
const users = new Map(); // socketId -> UserInfo
const tableUsers = new Map(); // Users actually at tables
const sessionStartTime = new Date();
let tableSessionStart = null; // When first user joins table
let firstUserJoinTime = null; // When first user connects via socket
let firstTableUserJoinTime = null; // When first user actually joins table
// Session statistics
function getSimpleSessionStats() {
    const currentTime = new Date();
    const sessionDuration = Math.floor((currentTime.getTime() - sessionStartTime.getTime()) / 1000);
    const tableSessionDuration = tableSessionStart
        ? Math.floor((currentTime.getTime() - tableSessionStart.getTime()) / 1000)
        : 0;
    const userCount = users.size;
    const tableUserCount = tableUsers.size;
    const activeUsers = Array.from(users.values())
        .map((u) => u.name)
        .join(", ");
    const tableActiveUsers = Array.from(tableUsers.values())
        .map((u) => u.name)
        .join(", ");
    return {
        userCount,
        tableUserCount,
        activeUsers,
        tableActiveUsers,
        sessionDuration,
        tableSessionDuration,
        sessionStartTime: sessionStartTime.toISOString(),
        tableSessionStart: tableSessionStart?.toISOString() || "none",
    };
}
// Session logging with enhanced timing info
function formatSessionLog(message, type = "INFO") {
    const stats = getSimpleSessionStats();
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${type}] ${message} | Socket Users: ${stats.userCount} (${stats.activeUsers || "none"}) | Table Users: ${stats.tableUserCount} (${stats.tableActiveUsers || "none"}) | Table Session: ${Math.floor(stats.tableSessionDuration / 60)}m${stats.tableSessionDuration % 60}s`;
}
// User activity tracking
function updateUserActivity(socketId) {
    const user = users.get(socketId);
    if (user) {
        user.lastActivity = new Date();
    }
}
// Session management functions
function addUser(socketId, userInfo) {
    users.set(socketId, userInfo);
    // Track first socket user connection
    if (users.size === 1 && !firstUserJoinTime) {
        firstUserJoinTime = new Date();
    }
}
function addTableUser(socketId) {
    const user = users.get(socketId);
    if (!user)
        return false;
    tableUsers.set(socketId, user);
    // Track first table user join - this is when table session actually starts
    if (tableUsers.size === 1 && !firstTableUserJoinTime) {
        firstTableUserJoinTime = new Date();
        tableSessionStart = firstTableUserJoinTime;
    }
    return true;
}
function removeUser(socketId) {
    users.delete(socketId);
    tableUsers.delete(socketId);
    // Reset table session timing when last user leaves
    if (tableUsers.size === 0) {
        tableSessionStart = null;
        firstTableUserJoinTime = null;
    }
}
function getUser(socketId) {
    return users.get(socketId);
}
function getUsers() {
    return users;
}
function getTableUsers() {
    return tableUsers;
}
// Detailed session stats for API
function getSessionStats() {
    const currentTime = new Date();
    const sessionDuration = Math.floor((currentTime.getTime() - sessionStartTime.getTime()) / 1000);
    const userCount = users.size;
    const activeUsers = Array.from(users.values()).map((u) => ({
        name: u.name,
        avatarId: u.avatarId,
        state: u.state,
        joinedAt: u.joinedAt,
        lastActivity: u.lastActivity,
        sessionDuration: Math.floor((currentTime.getTime() - u.joinedAt.getTime()) / 1000),
    }));
    return {
        userCount,
        activeUsers,
        sessionDuration,
        sessionStartTime: sessionStartTime.toISOString(),
        currentTime: currentTime.toISOString(),
        tableSessionStart: tableSessionStart?.toISOString() || "none",
        firstUserJoinTime: firstUserJoinTime?.toISOString() || "none",
        firstTableUserJoinTime: firstTableUserJoinTime?.toISOString() || "none",
    };
}

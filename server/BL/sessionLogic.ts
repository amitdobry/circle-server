// sessionLogic.ts - Session Management Business Logic

type UserState =
  | "regular"
  | "speaking"
  | "thinking"
  | "hasClickedMouth"
  | "hasClickedBrain";

export type UserInfo = {
  name: string;
  avatarId: string;
  state: UserState;
  interruptedBy: string;
  joinedAt: Date;
  lastActivity: Date;
};

// Session state
const users = new Map<string, UserInfo>(); // socketId -> UserInfo
const tableUsers = new Map<string, UserInfo>(); // Users actually at tables
const sessionStartTime = new Date();
let tableSessionStart: Date | null = null; // When first user joins table
let firstUserJoinTime: Date | null = null; // When first user connects via socket
let firstTableUserJoinTime: Date | null = null; // When first user actually joins table

// Session statistics
export function getSimpleSessionStats() {
  const currentTime = new Date();
  const sessionDuration = Math.floor(
    (currentTime.getTime() - sessionStartTime.getTime()) / 1000
  );
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
export function formatSessionLog(
  message: string,
  type: "INFO" | "JOIN" | "LEAVE" | "ERROR" = "INFO"
) {
  const stats = getSimpleSessionStats();
  const timestamp = new Date().toISOString();

  return `[${timestamp}] [${type}] ${message} | Socket Users: ${
    stats.userCount
  } (${stats.activeUsers || "none"}) | Table Users: ${stats.tableUserCount} (${
    stats.tableActiveUsers || "none"
  }) | Table Session: ${Math.floor(stats.tableSessionDuration / 60)}m${
    stats.tableSessionDuration % 60
  }s`;
}

// User activity tracking
export function updateUserActivity(socketId: string) {
  const user = users.get(socketId);
  if (user) {
    user.lastActivity = new Date();
  }
}

// Session management functions
export function addUser(socketId: string, userInfo: UserInfo) {
  users.set(socketId, userInfo);

  // Track first socket user connection
  if (users.size === 1 && !firstUserJoinTime) {
    firstUserJoinTime = new Date();
  }
}

export function addTableUser(socketId: string) {
  const user = users.get(socketId);
  if (!user) return false;

  tableUsers.set(socketId, user);

  // Track first table user join - this is when table session actually starts
  if (tableUsers.size === 1 && !firstTableUserJoinTime) {
    firstTableUserJoinTime = new Date();
    tableSessionStart = firstTableUserJoinTime;
  }

  return true;
}

export function removeUser(socketId: string) {
  users.delete(socketId);
  tableUsers.delete(socketId);
}

export function getUser(socketId: string): UserInfo | undefined {
  return users.get(socketId);
}

export function getUsers() {
  return users;
}

export function getTableUsers() {
  return tableUsers;
}

// Detailed session stats for API
export function getSessionStats() {
  const currentTime = new Date();
  const sessionDuration = Math.floor(
    (currentTime.getTime() - sessionStartTime.getTime()) / 1000
  );
  const userCount = users.size;
  const activeUsers = Array.from(users.values()).map((u) => ({
    name: u.name,
    avatarId: u.avatarId,
    state: u.state,
    joinedAt: u.joinedAt,
    lastActivity: u.lastActivity,
    sessionDuration: Math.floor(
      (currentTime.getTime() - u.joinedAt.getTime()) / 1000
    ),
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

// Load environment variables first
import dotenv from "dotenv";
dotenv.config();

// ============================================================
// FILE LOGGING: tee all console output to logs/server.log
// ============================================================
import fs from "fs";
import path from "path";

const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logFile = fs.createWriteStream(
  path.join(logsDir, `server-${new Date().toISOString().slice(0, 10)}.log`),
  { flags: "a" },
);

const origLog = console.log.bind(console);
const origError = console.error.bind(console);
const origWarn = console.warn.bind(console);

function writeToFile(level: string, args: any[]) {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(String).join(" ")}\n`;
  logFile.write(line);
}

console.log = (...args: any[]) => {
  origLog(...args);
  writeToFile("LOG", args);
};
console.error = (...args: any[]) => {
  origError(...args);
  writeToFile("ERR", args);
};
console.warn = (...args: any[]) => {
  origWarn(...args);
  writeToFile("WRN", args);
};
// ============================================================

// Debug environment variables
console.log("🔧 Environment check:");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "Set" : "NOT SET");
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "Set" : "NOT SET");
console.log("SESSION_SECRET:", process.env.SESSION_SECRET ? "Set" : "NOT SET");

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { setupSocketHandlers, getSessionStats } from "./server/socketHandler";
import { connectDB } from "./server/config/database";
import { configurePassport } from "./server/config/passport";
import authRoutes from "./server/routes/authRoutes";
import { logConfigSummary } from "./server/config/featureFlags";

const buildTime = new Date().toLocaleString("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const app = express();

// Connect to MongoDB
connectDB();

// Configure Passport
configurePassport();

// Log Engine Configuration (V1 vs V2 authority)
logConfigSummary();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration (needed for Passport)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api/auth", authRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// 🧪 Health check route
app.get("/isAlive", (_req, res) => {
  res.status(200).send(`
    <div style="font-family: monospace; color: green; padding: 1em;">
      🟢 SoulCircle server is alive..<br/>
      🕒 Build Time: ${buildTime}<br/>
      🔐 Auth: Ready<br/>
      🗄️ Database: ${process.env.MONGODB_URI ? "Configured" : "Not configured"}
    </div>
  `);
});

// 📊 Session status route (✅ Updated for Engine V2 per-room sessions)
app.get("/api/session/status", (_req, res) => {
  const stats = getSessionStats();
  res.json({
    status: "active",
    buildTime,
    ...stats,
    message:
      "Session stats now per-room. Use /api/rooms/active for room details.",
  });
});

// Session stats route (for timer updates) - ✅ Updated for Engine V2
app.get("/api/session/stats", (_req, res) => {
  const stats = getSessionStats();
  res.json(stats);
});

// Check if session is active - ✅ Updated for Engine V2 (returns true if ANY room active)
app.get("/api/session/active", (_req, res) => {
  const stats = getSessionStats();
  res.json({
    active: stats.sessionActive,
    activeRoomsCount: stats.activeRoomsCount,
  });
});

// Get all active rooms (Engine V2 Registry)
app.get("/api/rooms/active", (_req, res) => {
  const { roomRegistry } = require("./server/engine-v2/registry/RoomRegistry");

  const allRooms = roomRegistry.getAllRooms();
  const rooms = Array.from(allRooms.values()).map((room: any) => {
    const participantCount = room.participants.size;
    const currentSpeaker = room.liveSpeaker
      ? room.participants.get(room.liveSpeaker)
      : null;

    // Calculate elapsed time from timer
    const now = Date.now();
    const timerElapsed = room.timer.active
      ? Math.floor((now - room.timer.startTime) / 1000)
      : 0;

    // Calculate speaker time (for now, same as session time - can be enhanced later)
    const speakerTime = room.liveSpeaker ? timerElapsed : 0;

    return {
      roomId: room.roomId,
      sessionId: room.sessionId,
      participantCount,
      maxCapacity: 8, // Could make this configurable
      status:
        room.phase !== "LOBBY" && room.phase !== "ENDED" ? "active" : "waiting",
      currentSpeaker: currentSpeaker
        ? {
            socketId: room.liveSpeaker, // Include socketId for compatibility
            userId: room.liveSpeaker,
            name: currentSpeaker.displayName,
            avatar: currentSpeaker.avatarId,
          }
        : null,
      timer: {
        speakerTime: speakerTime,
        sessionTime: timerElapsed,
        totalDuration: Math.floor(room.timer.durationMs / 1000),
      },
      phase: room.phase,
      createdAt: new Date(room.createdAt).toISOString(),
    };
  });

  res.json({ rooms });
});

// Debug route to reset session state
app.post("/api/session/reset", (_req, res) => {
  const { resetSessionState } = require("./server/socketHandler");
  resetSessionState();
  res.json({ message: "Session state reset successfully" });
});

// Debug route to force session picker for testing
app.post("/api/session/force-picker", (_req, res) => {
  console.log("🔧 Force triggering session picker for all connected users");

  // Emit session picker to all connected clients
  io.emit("show-session-picker", {
    message: "DEBUG: Manually triggered session picker",
    options: [60, 30, 15, 5],
    allowCustom: true,
    isFirstUser: true,
    timestamp: new Date().toISOString(),
    debug: true,
  });

  res.json({ message: "Session picker force-triggered for all users" });
});

// Debug route to manually clear gliff log
app.post("/api/gliff/clear", (_req, res) => {
  console.log("🔧 Manually clearing gliff log");

  const { clearGliffLog } = require("./server/gliffLogService");
  clearGliffLog(io);

  res.json({ message: "Gliff log cleared successfully" });
});

// Debug route to manually clear all users and avatars
app.post("/api/users/clear", (_req, res) => {
  console.log("🔧 Manually clearing all users and releasing avatars");

  const {
    getUsers,
    resetSessionState,
    globalBroadcastUserList,
    globalBroadcastAvatarState,
  } = require("./server/socketHandler");
  const { releaseAvatarByName } = require("./server/avatarManager");
  const { removeUser } = require("./server/BL/sessionLogic");

  const users = getUsers();

  // Release all avatars
  for (const [socketId, user] of users.entries()) {
    console.log(
      `🔓 Force releasing avatar ${user.avatarId} for user ${user.name}`,
    );
    releaseAvatarByName(user.name);
    removeUser(socketId);
  }

  // Reset session state (clears users map)
  resetSessionState();

  // Broadcast clean state
  globalBroadcastUserList(io);
  globalBroadcastAvatarState(io);

  res.json({ message: "All users cleared and avatars released successfully" });
});

// Start a new session with specified duration
app.post("/api/session/start", (req: any, res: any) => {
  const { durationMinutes } = req.body;
  if (!durationMinutes || durationMinutes <= 0) {
    return res.status(400).json({ error: "Invalid duration" });
  }

  // Import setSessionTimeout dynamically to avoid circular deps
  const { setSessionTimeout } = require("./server/socketHandler");
  setSessionTimeout(durationMinutes);

  res.json({
    success: true,
    message: `Session started for ${durationMinutes} minutes`,
    durationMinutes,
  });
});

setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🌐 SoulCircle server running on http://localhost:${PORT}`);
  console.log(`📊 Session started at: ${new Date().toISOString()}`);
  console.log(`📈 Session status: http://localhost:${PORT}/api/session/status`);
});

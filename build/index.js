"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables first
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// ============================================================
// FILE LOGGING: tee all console output to logs/server.log
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logsDir = path_1.default.join(__dirname, "logs");
if (!fs_1.default.existsSync(logsDir))
    fs_1.default.mkdirSync(logsDir, { recursive: true });
const logFile = fs_1.default.createWriteStream(path_1.default.join(logsDir, `server-${new Date().toISOString().slice(0, 10)}.log`), { flags: "a" });
const origLog = console.log.bind(console);
const origError = console.error.bind(console);
const origWarn = console.warn.bind(console);
function writeToFile(level, args) {
    const line = `[${new Date().toISOString()}] [${level}] ${args.map(String).join(" ")}\n`;
    logFile.write(line);
}
console.log = (...args) => {
    origLog(...args);
    writeToFile("LOG", args);
};
console.error = (...args) => {
    origError(...args);
    writeToFile("ERR", args);
};
console.warn = (...args) => {
    origWarn(...args);
    writeToFile("WRN", args);
};
// ============================================================
// Debug environment variables
console.log("🔧 Environment check:");
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "Set" : "NOT SET");
console.log("MONGODB_URI:", process.env.MONGODB_URI ? "Set" : "NOT SET");
console.log("SESSION_SECRET:", process.env.SESSION_SECRET ? "Set" : "NOT SET");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const socketHandler_1 = require("./server/socketHandler");
const database_1 = require("./server/config/database");
const passport_2 = require("./server/config/passport");
const authRoutes_1 = __importDefault(require("./server/routes/authRoutes"));
const featureFlags_1 = require("./server/config/featureFlags");
const buildTime = new Date().toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
});
const app = (0, express_1.default)();
// Connect to MongoDB
(0, database_1.connectDB)();
// Configure Passport
(0, passport_2.configurePassport)();
// Log Engine Configuration (V1 vs V2 authority)
(0, featureFlags_1.logConfigSummary)();
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Session configuration (needed for Passport)
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || "your-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
}));
// Initialize Passport
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Routes
app.use("/api/auth", authRoutes_1.default);
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
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
    const stats = (0, socketHandler_1.getSessionStats)();
    res.json({
        status: "active",
        buildTime,
        ...stats,
        message: "Session stats now per-room. Use /api/rooms/active for room details.",
    });
});
// Session stats route (for timer updates) - ✅ Updated for Engine V2
app.get("/api/session/stats", (_req, res) => {
    const stats = (0, socketHandler_1.getSessionStats)();
    res.json(stats);
});
// Check if session is active - ✅ Updated for Engine V2 (returns true if ANY room active)
app.get("/api/session/active", (_req, res) => {
    const stats = (0, socketHandler_1.getSessionStats)();
    res.json({
        active: stats.sessionActive,
        activeRoomsCount: stats.activeRoomsCount,
    });
});
// Get all active rooms (Engine V2 Registry)
app.get("/api/rooms/active", (_req, res) => {
    const { roomRegistry } = require("./server/engine-v2/registry/RoomRegistry");
    const allRooms = roomRegistry.getAllRooms();
    const rooms = Array.from(allRooms.values()).map((room) => {
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
            status: room.phase !== "LOBBY" && room.phase !== "ENDED" ? "active" : "waiting",
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
    const { getUsers, resetSessionState, globalBroadcastUserList, globalBroadcastAvatarState, } = require("./server/socketHandler");
    const { releaseAvatarByName } = require("./server/avatarManager");
    const { removeUser } = require("./server/BL/sessionLogic");
    const users = getUsers();
    // Release all avatars
    for (const [socketId, user] of users.entries()) {
        console.log(`🔓 Force releasing avatar ${user.avatarId} for user ${user.name}`);
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
app.post("/api/session/start", (req, res) => {
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
(0, socketHandler_1.setupSocketHandlers)(io);
// 🆕 Initialize Content Configuration (Content Phase Feature)
console.log("📖 Initializing content configurations...");
const { contentConfigLoader, } = require("./server/config/content/ContentConfigLoader");
contentConfigLoader.initialize();
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🌐 SoulCircle server running on http://localhost:${PORT}`);
    console.log(`📊 Session started at: ${new Date().toISOString()}`);
    console.log(`📈 Session status: http://localhost:${PORT}/api/session/status`);
});

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const socketHandler_1 = require("./server/socketHandler");
const buildTime = new Date().toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
});
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});
// 🧪 Health check route
app.get("/isAlive", (_req, res) => {
    res.status(200).send(`
    <div style="font-family: monospace; color: green; padding: 1em;">
      🟢 SoulCircle server is alive..<br/>
      🕒 Build Time: ${buildTime}
    </div>
  `);
});
(0, socketHandler_1.setupSocketHandlers)(io);
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🌐 SoulCircle server running on http://localhost:${PORT}`);
});

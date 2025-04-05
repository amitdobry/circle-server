import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const users = new Map(); // socketId -> name
const pointerMap = new Map(); // from -> to
let liveSpeaker = null;

io.on("connection", (socket) => {
  console.log("🚪 New connection:", socket.id);

  socket.on("join", ({ name }) => {
    users.set(socket.id, name);
    console.log(`👤 ${name} joined`);
    broadcastUserList();
    sendInitialPointerMap(socket);
    sendCurrentLiveSpeaker(socket);
  });

  socket.on("leave", ({ name }) => {
    console.log(`👋 ${name} left manually`);
    cleanupUser(socket);
  });

  socket.on("disconnect", () => {
    const name = users.get(socket.id);
    console.log(`❌ ${name || "Unknown"} disconnected`);
    cleanupUser(socket);
  });

  socket.on("pointing", ({ from, to }) => {
    pointerMap.set(from, to);
    io.emit("update-pointing", { from, to });
    console.log(`🔁 ${from} ➡️ ${to}`);
    evaluateSync();
  });

  function evaluateSync() {
    const candidates = Array.from(users.values());
    let newLiveSpeaker = null;

    for (const candidate of candidates) {
      const everyoneElse = Array.from(users.values()).filter(
        (n) => n !== candidate
      );
      const allPointing = everyoneElse.every(
        (name) => pointerMap.get(name) === candidate
      );
      const selfPointing = pointerMap.get(candidate) === candidate;

      if (allPointing && selfPointing) {
        newLiveSpeaker = candidate;
        break;
      }
    }

    if (newLiveSpeaker !== liveSpeaker) {
      liveSpeaker = newLiveSpeaker;
      if (liveSpeaker) {
        console.log(`🎤 All attention on ${liveSpeaker}. Going LIVE.`);
        io.emit("live-speaker", { name: liveSpeaker });
      } else {
        console.log("🔇 No speaker in sync. Clearing Live tag.");
        io.emit("live-speaker-cleared");
      }
    }
  }

  function cleanupUser(socket) {
    const name = users.get(socket.id);
    if (!name) return;
    users.delete(socket.id);
    pointerMap.delete(name);

    for (const [from, to] of pointerMap.entries()) {
      if (to === name) pointerMap.delete(from);
    }

    broadcastUserList();
    evaluateSync();
  }

  function broadcastUserList() {
    const list = Array.from(users.values()).map((name) => ({ name }));
    io.emit("user-list", list);
  }

  function sendInitialPointerMap(socket) {
    const map = Array.from(pointerMap.entries()).map(([from, to]) => ({
      from,
      to,
    }));
    socket.emit("initial-pointer-map", map);
  }

  function sendCurrentLiveSpeaker(socket) {
    if (liveSpeaker) {
      socket.emit("live-speaker", { name: liveSpeaker });
    }
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🌐 SoulCircle server running on http://localhost:${PORT}`);
});

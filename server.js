// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

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
const raisedHands = new Set();

io.on("connection", (socket) => {
  console.log("🚪 New connection:", socket.id);

  socket.on("join", ({ name }) => {
    users.set(socket.id, name);
    console.log(`👤 ${name} joined`);
    broadcastUserList();
    sendInitialPointerMap(socket);
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
    checkIfFocusAchieved(from);
  });

  socket.on("raise-hand", ({ name }) => {
    raisedHands.add(name);
    io.emit("hand-raised", name);
    console.log(`✋ ${name} raised their hand`);
    checkIfFocusAchieved(name);
  });

  socket.on("lower-hand", ({ name }) => {
    raisedHands.delete(name);
    io.emit("hand-lowered", name);
  });

  function checkIfFocusAchieved(candidate) {
    if (!raisedHands.has(candidate)) return;
    const all = [...users.values()].filter((name) => name !== candidate);
    const everyonePointing = all.every(
      (name) => pointerMap.get(name) === candidate
    );

    if (everyonePointing) {
      console.log(`🎤 All attention on ${candidate}. Activating camera.`);
      io.emit("camera-activate", { name: candidate });
    }
  }

  function cleanupUser(socket) {
    const name = users.get(socket.id);
    if (!name) return;
    users.delete(socket.id);
    pointerMap.delete(name);
    raisedHands.delete(name);

    for (const [from, to] of pointerMap.entries()) {
      if (to === name) pointerMap.delete(from);
    }

    broadcastUserList();
  }

  function broadcastUserList() {
    const list = [...users.values()].map((name) => ({ name }));
    io.emit("user-list", list);
  }

  function sendInitialPointerMap(socket) {
    const map = [...pointerMap.entries()].map(([from, to]) => ({ from, to }));
    socket.emit("initial-pointer-map", map);
  }
});

server.listen(3001, () => {
  console.log("🌐 SoulCircle server running on http://localhost:3001");
});

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { setupSocketHandlers } from "./server/socketHandler";

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// 🧪 Health check route
app.get("/isAlive", (_req, res) => {
  res.status(200).send("🟢 SoulCircle server is alive.");
});

setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🌐 SoulCircle server running on http://localhost:${PORT}`);
});

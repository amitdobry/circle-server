// socketHandler.ts

import { Server, Socket } from "socket.io";
import {
  getAvailableAvatars,
  claimAvatar,
  releaseAvatarByName,
  emojiLookup,
} from "./avatarManager";
import { gestureCatalog } from "./ui-config/gestureCatalog";

type GestureCatalogType = typeof gestureCatalog;
type ListenerType = keyof GestureCatalogType; // "ear" | "brain" | "mouth"
type SubGestureCode<T extends ListenerType> = keyof GestureCatalogType[T];
type UserInfo = { name: string; avatarId: string };

const users = new Map<string, UserInfo>(); // socketId -> { name, avatarId }

const pointerMap = new Map<string, string>(); // from -> to
let liveSpeaker: string | null = null;
let currentLogInput: string = ""; // optional state if needed later

export function setupSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`🪪 New connection: ${socket.id}`);

    socket.on("joined-table", ({ name }) => {
      const avatar = users.get(socket.id)?.avatarId;
      const emoji = emojiLookup[avatar || ""] || "";
      logToConsole(`🪑 ${emoji} ${name} has fully entered the table`);
      sendCurrentUserListTo(socket); // send only to this socket
    });

    function sendCurrentUserListTo(socket: Socket) {
      const list = Array.from(users.values());
      socket.emit("user-list", list);
    }

    socket.on("request-join", ({ name, avatarId }) => {
      console.log(`📨 Request to join: ${name} as ${avatarId}`);

      if (!name || name.length > 30) {
        socket.emit("join-rejected", { reason: "Invalid name." });
        return;
      }

      // 🔥 Check for duplicate name
      const nameAlreadyTaken = Array.from(users.values()).some(
        (user) => user.name.toLowerCase() === name.toLowerCase()
      );

      if (nameAlreadyTaken) {
        console.warn(`⚠️ Name "${name}" already taken`);
        socket.emit("join-rejected", {
          reason: "Name already taken. Please choose another.",
        });
        return;
      }

      // 🔥 Try to claim the avatar
      const claimed = claimAvatar(avatarId, name);
      if (!claimed) {
        console.warn(`⚠️ Avatar ${avatarId} already taken`);
        socket.emit("join-rejected", {
          reason: "Avatar already taken. Please choose another.",
        });
        return;
      }

      // ✅ All good: Save user and broadcast
      users.set(socket.id, { name, avatarId });

      const emoji = emojiLookup[avatarId] || "";
      logToConsole(`👤 ${emoji} ${name} joined as ${avatarId}`);

      socket.emit("join-approved", { name, avatarId });

      broadcastUserList();
      broadcastAvatarState();
      sendInitialPointerMap(socket);
      sendCurrentLiveSpeaker(socket);
    });

    socket.on("ListenerEmits", ({ name, type, subType }) => {
      const user = users.get(socket.id);

      if (!user) {
        console.warn(`🛑 Rejected ListenerEmits — unknown socket ${socket.id}`);
        return;
      }

      if (!["ear", "brain", "mouth"].includes(type)) {
        console.warn(`🌀 Invalid ListenerEmit type: ${type}`);
        return;
      }

      const safeType = type as ListenerType;
      const rawGesture =
        gestureCatalog[safeType]?.[
          subType as keyof GestureCatalogType[typeof safeType]
        ];
      const gesture = rawGesture as import("./ui-config/Gestures").Gesture;

      if (!gesture) {
        console.warn(`🚫 Unknown gesture code: ${type}:${subType}`);
        return;
      }

      const emoji = gesture.emoji;
      const label = gesture.label;

      switch (safeType) {
        case "ear":
          logToConsole(`🎧 ${emoji} ${name} says: "${label}"`);
          //   io.emit("TextBoxUpdate", gesture.getBroadcastPayload(name));
          break;

        case "brain":
          logToConsole(`🧠 ${name} requested silence: "${gesture.label}"`);
          //   io.emit("PauseForThought", {
          //     by: name,
          //     reasonCode: subType,
          //     ...gesture.getBroadcastPayload(name), // includes label, emoji, color
          //   });
          break;

        case "mouth":
          logToConsole(`👄 ${name} requests the mic: "${gesture.label}"`);
          pointerMap.set(name, name);
          io.emit("update-pointing", { from: name, to: name });
          evaluateSync();
          break;
      }

      gesture.triggerEffect?.(); // Optional future rituals
    });

    socket.on("leave", ({ name }) => {
      logToConsole(`👋 ${name} left manually`);
      cleanupUser(socket);
    });

    socket.on("disconnect", () => {
      const user = users.get(socket.id);
      logToConsole(`❌ ${user?.name || "Unknown"} disconnected`);
      cleanupUser(socket);
    });

    socket.on("pointing", ({ from, to }) => {
      pointerMap.set(from, to);
      io.emit("update-pointing", { from, to });
      const avatarId =
        Array.from(users.values()).find((u) => u.name === from)?.avatarId || "";
      const emoji = emojiLookup[avatarId] || "";
      if (from === to) {
        logToConsole(`✋ ${emoji} ${from} wishes to speak`);
      } else {
        logToConsole(`🔁 ${emoji} ${from} ➡️ ${to}`);
      }
      evaluateSync();
    });

    socket.on(
      "logBar:update",
      ({ text, userName }: { text: string; userName: string }) => {
        const user = users.get(socket.id);

        if (!user) {
          console.log(
            `🚫 Rejected logBar:update — unknown user (${socket.id})`
          );
          return;
        }

        if (user.name !== liveSpeaker) {
          console.log(
            `🚫 Rejected logBar:update — ${user.name} is not live (liveSpeaker=${liveSpeaker})`
          );
          return;
        }

        console.log(`📡 logBar:update from ${user.name}:`, text);

        io.emit("logBar:update", {
          text,
          userName,
        });
      }
    );

    // Optional P2P (currently dormant)
    socket.on("peer-signal", ({ to, from, signal }) => {
      for (const [socketId, name] of users.entries()) {
        if (name === to) {
          io.to(socketId).emit("peer-signal", { from, signal });
          break;
        }
      }
    });

    // Request: list of avatars
    socket.on("get-avatars", () => {
      socket.emit("avatars", getAvailableAvatars());
    });

    function cleanupUser(socket: Socket) {
      const user = users.get(socket.id);
      if (!user) return;

      users.delete(socket.id);
      pointerMap.delete(user.name);
      releaseAvatarByName(user.name);

      for (const [from, to] of pointerMap.entries()) {
        if (to === user.name) pointerMap.delete(from);
      }

      broadcastUserList();
      broadcastAvatarState();
      evaluateSync();
    }

    function broadcastUserList() {
      const list = Array.from(users.values()); // now includes avatarId
      io.emit("user-list", list);
    }

    function broadcastAvatarState() {
      io.emit("avatars", getAvailableAvatars());
    }

    function sendInitialPointerMap(socket: Socket) {
      const map = Array.from(pointerMap.entries()).map(([from, to]) => ({
        from,
        to,
      }));
      socket.emit("initial-pointer-map", map);
    }

    function sendCurrentLiveSpeaker(socket: Socket) {
      if (liveSpeaker) {
        socket.emit("live-speaker", { name: liveSpeaker });
      }
    }

    function logToConsole(msg: string) {
      io.emit("log-event", msg); // 🔥 everyone gets it
      console.log(msg);
    }

    function evaluateSync() {
      const candidates = Array.from(users.values());
      let newLiveSpeaker: string | null = null;

      for (const candidate of candidates) {
        const everyoneElse = candidates.filter(
          (n) => n.name !== candidate.name
        );
        const allPointing = everyoneElse.every(
          (n) => pointerMap.get(n.name) === candidate.name
        );
        const selfPointing = pointerMap.get(candidate.name) === candidate.name;

        if (allPointing && selfPointing) {
          newLiveSpeaker = candidate.name;
          break;
        }
      }

      if (newLiveSpeaker !== liveSpeaker) {
        liveSpeaker = newLiveSpeaker;
        if (liveSpeaker) {
          logToConsole(`🎤 All attention on ${liveSpeaker}. Going LIVE.`);
          io.emit("live-speaker", { name: liveSpeaker });

          io.emit("logBar:update", {
            text: `${liveSpeaker}: `,
            userName: liveSpeaker,
          });
        } else {
          logToConsole("🔇 No speaker in sync. Clearing Live tag.");
          io.emit("live-speaker-cleared");
        }
      }
    }
  });
}

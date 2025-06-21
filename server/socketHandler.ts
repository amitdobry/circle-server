// socketHandler.ts

import { Server, Socket } from "socket.io";
import {
  getAvailableAvatars,
  claimAvatar,
  releaseAvatarByName,
  emojiLookup,
} from "./avatarManager";
import { gestureCatalog } from "./ui-config/gestureCatalog";
import { getAllGestureButtons } from "./ui-config/gesture.service";
import { routeAction } from "./actions/routeAction"; // adjust path if needed
import { getPanelConfigFor } from "./panelConfigService"; // or wherever you store them

type GestureCatalogType = typeof gestureCatalog;
type ListenerType = keyof GestureCatalogType; // "ear" | "brain" | "mouth"
type SubGestureCode<T extends ListenerType> = keyof GestureCatalogType[T];
type UserState =
  | "regular"
  | "speaking"
  | "thinking"
  | "hasClickedMouth"
  | "hasClickedBrain";

type UserInfo = {
  name: string;
  avatarId: string;
  state: UserState;
  interruptedBy: string;
};

const users = new Map<string, UserInfo>(); // socketId -> { name, avatarId }

const pointerMap = new Map<string, string>(); // from -> to
let liveSpeaker: string | null = null;
let currentLogInput: string = ""; // optional state if needed later

let isSyncPauseMode = false;

export function getIsSyncPauseMode() {
  return isSyncPauseMode;
}

export function setIsSyncPauseMode(value: boolean) {
  isSyncPauseMode = value;
}

export function getPointerMap() {
  return pointerMap;
}

export function getLiveSpeaker() {
  return liveSpeaker;
}

export function setLiveSpeaker(name: string | null) {
  liveSpeaker = name;
}

export function getUsers() {
  return users;
}

export function setupSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    console.log(`🪪 New connection: ${socket.id}`);

    socket.on("joined-table", ({ name }) => {
      const avatar = users.get(socket.id)?.avatarId;
      console.log(
        `[Server] 🔔 'joined-table' received from socket ${socket.id}, name: ${name}`
      );
      const emoji = emojiLookup[avatar || ""] || "";
      emitSystemLog(`🪑 ${emoji} ${name} has fully entered the table`);
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
      users.set(socket.id, {
        name,
        avatarId,
        state: "regular",
        interruptedBy: "",
      });

      const emoji = emojiLookup[avatarId] || "";
      emitSystemLog(`👤 ${emoji} ${name} joined as ${avatarId}`);

      socket.emit("join-approved", { name, avatarId });

      broadcastUserList();
      broadcastAvatarState();
      sendInitialPointerMap(socket);
      sendCurrentLiveSpeaker(socket);
    });

    socket.on(
      "clientEmits",
      ({ name, type, subType, actionType, targetUser }) => {
        const user = users.get(socket.id);

        if (!user) {
          console.warn(`🛑 Rejected clientEmits — unknown socket ${socket.id}`);
          return;
        }

        if (!["ear", "brain", "mouth", "mic"].includes(type)) {
          console.warn(`🌀 Invalid ListenerEmit type: ${type}`);
          return;
        }

        routeAction(
          { name, type, subType, actionType, targetUser },
          {
            io,
            logSystem: emitSystemLog,
            logAction: emitActionLog,
            pointerMap,
            evaluateSync,
            gestureCatalog,
            socketId: socket.id,
            users,
          }
        );
      }
    );

    socket.on("leave", ({ name }) => {
      emitSystemLog(`👋 ${name} left manually`);
      cleanupUser(socket);
    });

    socket.on("disconnect", () => {
      const user = users.get(socket.id);
      emitSystemLog(`❌ ${user?.name || "Unknown"} disconnected`);
      cleanupUser(socket);
    });

    socket.on("pointing", ({ from, to }) => {
      console.log("[Client] Emitting pointing to:", from, to);
      routeAction(
        {
          from,
          type: "pointing",
          subType: "manual",
          actionType: "pointAtSpeaker",
          to,
        },
        {
          io,
          logSystem: emitSystemLog,
          logAction: emitActionLog,
          pointerMap,
          evaluateSync,
          gestureCatalog,
          socketId: socket.id,
          users,
        }
      );
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

    socket.on("request:gestureButtons", () => {
      console.log("[Server] Received request:gestureButtons");
      const buttons = getAllGestureButtons();
      socket.emit("receive:gestureButtons", buttons);
    });

    socket.on("request:panelConfig", ({ userName }) => {
      if (!userName) {
        console.warn("⚠️ No userName provided in request:panelConfig");
        return;
      }

      console.log(`🛠️ Building panel config for ${userName}`);

      const config = getPanelConfigFor(userName);
      // console.log(
      //   "[Server] Sending attention panel config:",
      //   JSON.stringify(config, null, 2)
      // );
      socket.emit("receive:panelConfig", config);
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
      setIsSyncPauseMode(false);
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

    // function logToConsole(msg: string) {
    //   io.emit("log-event", msg); // 🔥 everyone gets it
    //   // io.emit("log-")
    //   console.log(msg);
    // }

    function emitSystemLog(text: string) {
      io.emit("system-log", text);
      console.log("[SYSTEM]", text);
    }

    function emitActionLog(text: string) {
      io.emit("action-log", text); // ✅ renamed
      console.log("[ACTION]", text);
    }

    function emitTextLog(entry: { userName: string; text: string }) {
      const payload = { ...entry, timestamp: Date.now() };
      io.emit("textlog:entry", payload);
      console.log("[TEXT]", payload);
    }

    function evaluateSync() {
      const candidates = Array.from(users.values());
      let newLiveSpeaker: string | null = null;

      for (const candidate of candidates) {
        const everyoneElse = candidates.filter(
          (u) => u.name !== candidate.name
        );

        const allPointing = everyoneElse.every(
          (u) => pointerMap.get(u.name) === candidate.name
        );
        const selfPointing = pointerMap.get(candidate.name) === candidate.name;

        if (allPointing && selfPointing) {
          newLiveSpeaker = candidate.name;
          break;
        }
      }

      for (const [socketId, user] of users.entries()) {
        if (user.name === newLiveSpeaker) {
          user.state = "speaking";
          users.set(socketId, user);
        }
      }

      if (newLiveSpeaker !== liveSpeaker) {
        liveSpeaker = newLiveSpeaker;

        if (liveSpeaker) {
          emitActionLog(`🎤 All attention on ${liveSpeaker}. Going LIVE.`);
          // 💡 Reset concent-mode users to regular listeners
          for (const [socketId, user] of users.entries()) {
            if (user.name !== liveSpeaker) {
              user.state = "regular";
              users.set(socketId, user);
            }
          }
          setIsSyncPauseMode(false);
          io.emit("live-speaker", { name: liveSpeaker });
          io.emit("logBar:update", {
            text: `${liveSpeaker}: `,
            userName: liveSpeaker,
          });
          for (const [socketId, user] of users.entries()) {
            const config = getPanelConfigFor(user.name);
            io.to(socketId).emit("receive:panelConfig", config);
          }
        } else {
          emitActionLog("🔇 No speaker in sync. Clearing Live tag.");
          io.emit("live-speaker-cleared");
        }
      }
    }
  });
}

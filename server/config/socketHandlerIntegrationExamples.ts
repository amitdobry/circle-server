// @ts-nocheck
/**
 * Socket Handler Integration Examples
 *
 * ⚠️ THIS FILE IS FOR REFERENCE/DOCUMENTATION ONLY
 * It contains example patterns showing how to integrate Engine V2 feature flags
 * into socketHandler.ts. Copy and adapt these patterns as needed.
 *
 * This file is excluded from compilation (see @ts-nocheck above).
 *
 * Shows how to integrate Engine V2 feature flags into socketHandler.ts
 * for gradual authority handoff from V1 to V2.
 */

import { Socket, Server } from "socket.io";
import {
  shouldUseV2,
  isShadowModeActive,
  shouldExecuteV2Effects,
} from "../config/featureFlags";
import { dispatch } from "../engine-v2/reducer/dispatch";
import { runEffects } from "../engine-v2/effects/runEffects";
import { shadowDispatch } from "../engine-v2/shadow/shadowDispatcher";
import {
  mapLegacyToV2Action,
  extractRoomId,
} from "../engine-v2/shadow/actionMapper";
import { roomRegistry } from "../engine-v2/registry/RoomRegistry";

// ============================================================================
// EXAMPLE 1: Panel Config (Low Risk - Good First Feature)
// ============================================================================

export function setupPanelConfigHandler(socket: Socket, io: Server) {
  socket.on("request:panelConfig", async ({ userName }) => {
    console.log(`📋 Panel config requested for: ${userName}`);

    if (shouldUseV2("PANEL_CONFIG")) {
      // ✨ V2 HAS AUTHORITY
      console.log("[V2] Handling panel config");

      const roomId = extractRoomId(socket, { userName });
      const userId = socket.id;
      const action = mapLegacyToV2Action("request:panelConfig", { userName });

      // Dispatch to V2 engine
      const effects = dispatch(roomId, userId, action);

      // Execute effects (includes emitting panel config)
      if (shouldExecuteV2Effects()) {
        runEffects(effects, io);
      }
    } else {
      // 📜 V1 FALLBACK
      console.log("[V1] Handling panel config (legacy)");

      const config = getPanelConfigFor(userName); // V1 logic
      socket.emit("receive:panelConfig", config);
    }

    // Shadow observation (runs in SHADOW or HYBRID mode)
    if (isShadowModeActive() && !shouldUseV2("PANEL_CONFIG")) {
      const roomId = extractRoomId(socket, { userName });
      const userId = socket.id;
      const action = mapLegacyToV2Action("request:panelConfig", { userName });
      shadowDispatch(roomId, userId, action);
    }
  });
}

// ============================================================================
// EXAMPLE 2: Session Control (High Risk - Enable Later)
// ============================================================================

export function setupSessionControlHandlers(socket: Socket, io: Server) {
  // Start session
  socket.on("start-session", ({ durationMinutes }) => {
    console.log(`🎬 Start session requested: ${durationMinutes} minutes`);

    if (shouldUseV2("SESSION_CONTROL")) {
      // ✨ V2 HAS AUTHORITY
      console.log("[V2] Starting session with V2 engine");

      const roomId = extractRoomId(socket, { durationMinutes });
      const userId = socket.id;
      const action = {
        type: "START_SESSION",
        payload: {
          durationMinutes,
          initiatorId: userId,
          initiatorName: socket.data?.userName || "Unknown",
        },
      };

      // Dispatch and execute effects
      const effects = dispatch(roomId, userId, action);

      if (shouldExecuteV2Effects()) {
        runEffects(effects, io);
      }

      // Sync V1 state from V2 (for backward compatibility during transition)
      const room = roomRegistry.getRoom(roomId);
      if (room) {
        sessionActive = room.phase !== "LOBBY";
        sessionId = room.sessionId;
      }
    } else {
      // 📜 V1 FALLBACK
      console.log("[V1] Starting session with V1 engine (legacy)");

      // Original V1 logic
      if (sessionActive) {
        socket.emit("session-already-active");
        return;
      }

      sessionActive = true;
      sessionId = generateSessionId();

      // Start V1 timer
      startSessionWithDuration(io, durationMinutes);

      // Emit to all clients
      io.emit("session-started", {
        sessionId,
        durationMinutes,
        startTime: new Date(),
      });
    }

    // Shadow observation
    if (isShadowModeActive() && !shouldUseV2("SESSION_CONTROL")) {
      const roomId = extractRoomId(socket, { durationMinutes });
      const action = mapLegacyToV2Action("start-session", { durationMinutes });
      shadowDispatch(roomId, socket.id, action);
    }
  });

  // End session
  socket.on("end-session", ({ reason }) => {
    console.log(`🏁 End session requested: ${reason}`);

    if (shouldUseV2("SESSION_CONTROL")) {
      // ✨ V2 HAS AUTHORITY
      const roomId = extractRoomId(socket, { reason });
      const action = {
        type: "END_SESSION",
        payload: { reason, initiatorId: socket.id },
      };

      const effects = dispatch(roomId, socket.id, action);

      if (shouldExecuteV2Effects()) {
        runEffects(effects, io, roomRegistry);
      }
    } else {
      // 📜 V1 FALLBACK
      if (!sessionActive) return;

      sessionActive = false;
      if (sessionTimer) {
        clearTimeout(sessionTimer);
        sessionTimer = null;
      }

      io.emit("session-ended", { reason });
    }

    // Shadow observation
    if (isShadowModeActive() && !shouldUseV2("SESSION_CONTROL")) {
      const roomId = extractRoomId(socket, { reason });
      const action = mapLegacyToV2Action("end-session", { reason });
      shadowDispatch(roomId, socket.id, action);
    }
  });
}

// ============================================================================
// EXAMPLE 3: User Join (High Risk - Complex State)
// ============================================================================

export function setupUserJoinHandler(socket: Socket, io: Server) {
  socket.on("request-join", async ({ name, avatarId }) => {
    console.log(`👤 User join requested: ${name} (avatar: ${avatarId})`);

    if (shouldUseV2("USER_MANAGEMENT")) {
      // ✨ V2 HAS AUTHORITY
      console.log("[V2] Handling user join with V2 engine");

      const roomId = extractRoomId(socket, { name, avatarId });
      const userId = socket.id;
      const action = {
        type: "JOIN_SESSION",
        payload: {
          name,
          avatarId,
          socketId: socket.id,
          joinTime: new Date(),
        },
      };

      // Dispatch to V2
      const effects = dispatch(roomId, userId, action);

      if (shouldExecuteV2Effects()) {
        runEffects(effects, io, roomRegistry);
      }

      // Check if join was successful by reading V2 state
      const room = roomRegistry.getRoom(roomId);
      const participant = room?.participants.get(userId);

      if (participant?.connectionState === "CONNECTED") {
        // Sync to V1 state for backward compatibility
        users.set(socket.id, {
          name,
          avatarId,
          state: "regular",
          interruptedBy: "",
          joinedAt: new Date(),
          lastActivity: new Date(),
        });
      }
    } else {
      // 📜 V1 FALLBACK
      console.log("[V1] Handling user join with V1 engine (legacy)");

      // Check avatar availability
      const claimed = claimAvatar(avatarId, name);
      if (!claimed) {
        socket.emit("join-rejected", { reason: "Avatar already taken" });
        return;
      }

      // Add user to V1 state
      const joinTime = new Date();
      const userInfo = {
        name,
        avatarId,
        state: "regular" as const,
        interruptedBy: "",
        joinedAt: joinTime,
        lastActivity: joinTime,
      };

      users.set(socket.id, userInfo);
      addUserToBL(socket.id, userInfo);

      // Approve join
      socket.emit("join-approved", { name, avatarId });

      // Broadcast to others
      io.emit("user-list", getUserListForBroadcast());
    }

    // Shadow observation
    if (isShadowModeActive() && !shouldUseV2("USER_MANAGEMENT")) {
      const roomId = extractRoomId(socket, { name, avatarId });
      const action = mapLegacyToV2Action("request-join", {
        name,
        avatarId,
        socketId: socket.id,
      });
      shadowDispatch(roomId, socket.id, action);
    }
  });
}

// ============================================================================
// EXAMPLE 4: Pointing System (Medium Risk)
// ============================================================================

export function setupPointingHandlers(socket: Socket, io: Server) {
  socket.on("setPointer", ({ targetName }) => {
    console.log(`👉 Pointer set: ${socket.data?.userName} → ${targetName}`);

    if (shouldUseV2("POINTING")) {
      // ✨ V2 HAS AUTHORITY
      const roomId = extractRoomId(socket, { targetName });
      const action = {
        type: "SET_POINTER",
        payload: {
          sourceId: socket.id,
          sourceName: socket.data?.userName,
          targetName,
        },
      };

      const effects = dispatch(roomId, socket.id, action);

      if (shouldExecuteV2Effects()) {
        runEffects(effects, io, roomRegistry);
      }
    } else {
      // 📜 V1 FALLBACK
      const userName = socket.data?.userName;
      if (!userName) return;

      pointerMap.set(userName, targetName);

      // Broadcast updated pointer map
      const pointerObj = Object.fromEntries(pointerMap);
      io.emit("pointer-map-updated", pointerObj);
    }

    // Shadow observation
    if (isShadowModeActive() && !shouldUseV2("POINTING")) {
      const roomId = extractRoomId(socket, { targetName });
      const action = mapLegacyToV2Action("setPointer", {
        targetName,
        userName: socket.data?.userName,
      });
      shadowDispatch(roomId, socket.id, action);
    }
  });
}

// ============================================================================
// EXAMPLE 5: State Queries (Low Risk - Read Only)
// ============================================================================

export function setupStateQueryHandlers(socket: Socket) {
  socket.on("request:session-status", () => {
    if (shouldUseV2("STATE_QUERIES")) {
      // ✨ V2 HAS AUTHORITY (read state from V2)
      const roomId = extractRoomId(socket, {});
      const room = roomRegistry.getRoom(roomId);

      if (room) {
        socket.emit("receive:session-status", {
          active: room.phase !== "LOBBY",
          phase: room.phase,
          sessionId: room.sessionId,
          participants: room.participants.size,
          timer: room.timer,
        });
      } else {
        socket.emit("receive:session-status", {
          active: false,
          phase: "LOBBY",
          sessionId: null,
          participants: 0,
          timer: { active: false, remainingMs: 0 },
        });
      }
    } else {
      // 📜 V1 FALLBACK (read from V1 state)
      socket.emit("receive:session-status", {
        active: sessionActive,
        sessionId,
        participants: users.size,
        // V1 doesn't track detailed state
      });
    }
  });
}

// ============================================================================
// HYBRID HANDLER UTILITY
// ============================================================================

/**
 * Generic hybrid handler that runs V1 or V2 based on feature flag
 * with automatic fallback and shadow observation
 */
export async function hybridHandler<T>(
  feature: string,
  socket: Socket,
  io: Server,
  options: {
    v1Handler: () => T | Promise<T>;
    v2Action: any;
    roomId?: string;
    fallbackOnError?: boolean;
  },
): Promise<T> {
  const {
    v1Handler,
    v2Action,
    roomId = "default-room",
    fallbackOnError = true,
  } = options;

  if (shouldUseV2(feature as any)) {
    // V2 has authority
    try {
      const effects = dispatch(roomId, socket.id, v2Action);

      if (shouldExecuteV2Effects()) {
        runEffects(effects, io, roomRegistry);
      }

      // Return V2 result (you may need to extract from effects or room state)
      const room = roomRegistry.getRoom(roomId);
      return room as any; // Customize based on what you need
    } catch (error) {
      console.error(`[V2] ${feature} failed:`, error);

      if (fallbackOnError) {
        console.log(`[V2] Falling back to V1 for ${feature}`);
        return await v1Handler();
      }
      throw error;
    }
  } else {
    // V1 has authority
    const result = await v1Handler();

    // Shadow observation
    if (isShadowModeActive()) {
      shadowDispatch(roomId, socket.id, v2Action);
    }

    return result;
  }
}

// Usage example:
// await hybridHandler("SESSION_CONTROL", socket, io, {
//   v1Handler: () => startV1Session(durationMinutes),
//   v2Action: { type: "START_SESSION", payload: { durationMinutes } },
// });

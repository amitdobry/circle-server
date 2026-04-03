"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupPanelConfigHandler = setupPanelConfigHandler;
exports.setupSessionControlHandlers = setupSessionControlHandlers;
exports.setupUserJoinHandler = setupUserJoinHandler;
exports.setupPointingHandlers = setupPointingHandlers;
exports.setupStateQueryHandlers = setupStateQueryHandlers;
exports.hybridHandler = hybridHandler;
const featureFlags_1 = require("../config/featureFlags");
const dispatch_1 = require("../engine-v2/reducer/dispatch");
const runEffects_1 = require("../engine-v2/effects/runEffects");
const shadowDispatcher_1 = require("../engine-v2/shadow/shadowDispatcher");
const actionMapper_1 = require("../engine-v2/shadow/actionMapper");
const RoomRegistry_1 = require("../engine-v2/registry/RoomRegistry");
// ============================================================================
// EXAMPLE 1: Panel Config (Low Risk - Good First Feature)
// ============================================================================
function setupPanelConfigHandler(socket, io) {
    socket.on("request:panelConfig", async ({ userName }) => {
        console.log(`📋 Panel config requested for: ${userName}`);
        if ((0, featureFlags_1.shouldUseV2)("PANEL_CONFIG")) {
            // ✨ V2 HAS AUTHORITY
            console.log("[V2] Handling panel config");
            const roomId = (0, actionMapper_1.extractRoomId)(socket, { userName });
            const userId = socket.id;
            const action = (0, actionMapper_1.mapLegacyToV2Action)("request:panelConfig", { userName });
            // Dispatch to V2 engine
            const effects = (0, dispatch_1.dispatch)(roomId, userId, action);
            // Execute effects (includes emitting panel config)
            if ((0, featureFlags_1.shouldExecuteV2Effects)()) {
                (0, runEffects_1.runEffects)(effects, io);
            }
        }
        else {
            // 📜 V1 FALLBACK
            console.log("[V1] Handling panel config (legacy)");
            const config = getPanelConfigFor(userName); // V1 logic
            socket.emit("receive:panelConfig", config);
        }
        // Shadow observation (runs in SHADOW or HYBRID mode)
        if ((0, featureFlags_1.isShadowModeActive)() && !(0, featureFlags_1.shouldUseV2)("PANEL_CONFIG")) {
            const roomId = (0, actionMapper_1.extractRoomId)(socket, { userName });
            const userId = socket.id;
            const action = (0, actionMapper_1.mapLegacyToV2Action)("request:panelConfig", { userName });
            (0, shadowDispatcher_1.shadowDispatch)(roomId, userId, action);
        }
    });
}
// ============================================================================
// EXAMPLE 2: Session Control (High Risk - Enable Later)
// ============================================================================
function setupSessionControlHandlers(socket, io) {
    // Start session
    socket.on("start-session", ({ durationMinutes }) => {
        console.log(`🎬 Start session requested: ${durationMinutes} minutes`);
        if ((0, featureFlags_1.shouldUseV2)("SESSION_CONTROL")) {
            // ✨ V2 HAS AUTHORITY
            console.log("[V2] Starting session with V2 engine");
            const roomId = (0, actionMapper_1.extractRoomId)(socket, { durationMinutes });
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
            const effects = (0, dispatch_1.dispatch)(roomId, userId, action);
            if ((0, featureFlags_1.shouldExecuteV2Effects)()) {
                (0, runEffects_1.runEffects)(effects, io);
            }
            // Sync V1 state from V2 (for backward compatibility during transition)
            const room = RoomRegistry_1.roomRegistry.getRoom(roomId);
            if (room) {
                sessionActive = room.phase !== "LOBBY";
                sessionId = room.sessionId;
            }
        }
        else {
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
        if ((0, featureFlags_1.isShadowModeActive)() && !(0, featureFlags_1.shouldUseV2)("SESSION_CONTROL")) {
            const roomId = (0, actionMapper_1.extractRoomId)(socket, { durationMinutes });
            const action = (0, actionMapper_1.mapLegacyToV2Action)("start-session", { durationMinutes });
            (0, shadowDispatcher_1.shadowDispatch)(roomId, socket.id, action);
        }
    });
    // End session
    socket.on("end-session", ({ reason }) => {
        console.log(`🏁 End session requested: ${reason}`);
        if ((0, featureFlags_1.shouldUseV2)("SESSION_CONTROL")) {
            // ✨ V2 HAS AUTHORITY
            const roomId = (0, actionMapper_1.extractRoomId)(socket, { reason });
            const action = {
                type: "END_SESSION",
                payload: { reason, initiatorId: socket.id },
            };
            const effects = (0, dispatch_1.dispatch)(roomId, socket.id, action);
            if ((0, featureFlags_1.shouldExecuteV2Effects)()) {
                (0, runEffects_1.runEffects)(effects, io, RoomRegistry_1.roomRegistry);
            }
        }
        else {
            // 📜 V1 FALLBACK
            if (!sessionActive)
                return;
            sessionActive = false;
            if (sessionTimer) {
                clearTimeout(sessionTimer);
                sessionTimer = null;
            }
            io.emit("session-ended", { reason });
        }
        // Shadow observation
        if ((0, featureFlags_1.isShadowModeActive)() && !(0, featureFlags_1.shouldUseV2)("SESSION_CONTROL")) {
            const roomId = (0, actionMapper_1.extractRoomId)(socket, { reason });
            const action = (0, actionMapper_1.mapLegacyToV2Action)("end-session", { reason });
            (0, shadowDispatcher_1.shadowDispatch)(roomId, socket.id, action);
        }
    });
}
// ============================================================================
// EXAMPLE 3: User Join (High Risk - Complex State)
// ============================================================================
function setupUserJoinHandler(socket, io) {
    socket.on("request-join", async ({ name, avatarId }) => {
        console.log(`👤 User join requested: ${name} (avatar: ${avatarId})`);
        if ((0, featureFlags_1.shouldUseV2)("USER_MANAGEMENT")) {
            // ✨ V2 HAS AUTHORITY
            console.log("[V2] Handling user join with V2 engine");
            const roomId = (0, actionMapper_1.extractRoomId)(socket, { name, avatarId });
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
            const effects = (0, dispatch_1.dispatch)(roomId, userId, action);
            if ((0, featureFlags_1.shouldExecuteV2Effects)()) {
                (0, runEffects_1.runEffects)(effects, io, RoomRegistry_1.roomRegistry);
            }
            // Check if join was successful by reading V2 state
            const room = RoomRegistry_1.roomRegistry.getRoom(roomId);
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
        }
        else {
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
                state: "regular",
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
        if ((0, featureFlags_1.isShadowModeActive)() && !(0, featureFlags_1.shouldUseV2)("USER_MANAGEMENT")) {
            const roomId = (0, actionMapper_1.extractRoomId)(socket, { name, avatarId });
            const action = (0, actionMapper_1.mapLegacyToV2Action)("request-join", {
                name,
                avatarId,
                socketId: socket.id,
            });
            (0, shadowDispatcher_1.shadowDispatch)(roomId, socket.id, action);
        }
    });
}
// ============================================================================
// EXAMPLE 4: Pointing System (Medium Risk)
// ============================================================================
function setupPointingHandlers(socket, io) {
    socket.on("setPointer", ({ targetName }) => {
        console.log(`👉 Pointer set: ${socket.data?.userName} → ${targetName}`);
        if ((0, featureFlags_1.shouldUseV2)("POINTING")) {
            // ✨ V2 HAS AUTHORITY
            const roomId = (0, actionMapper_1.extractRoomId)(socket, { targetName });
            const action = {
                type: "SET_POINTER",
                payload: {
                    sourceId: socket.id,
                    sourceName: socket.data?.userName,
                    targetName,
                },
            };
            const effects = (0, dispatch_1.dispatch)(roomId, socket.id, action);
            if ((0, featureFlags_1.shouldExecuteV2Effects)()) {
                (0, runEffects_1.runEffects)(effects, io, RoomRegistry_1.roomRegistry);
            }
        }
        else {
            // 📜 V1 FALLBACK
            const userName = socket.data?.userName;
            if (!userName)
                return;
            pointerMap.set(userName, targetName);
            // Broadcast updated pointer map
            const pointerObj = Object.fromEntries(pointerMap);
            io.emit("pointer-map-updated", pointerObj);
        }
        // Shadow observation
        if ((0, featureFlags_1.isShadowModeActive)() && !(0, featureFlags_1.shouldUseV2)("POINTING")) {
            const roomId = (0, actionMapper_1.extractRoomId)(socket, { targetName });
            const action = (0, actionMapper_1.mapLegacyToV2Action)("setPointer", {
                targetName,
                userName: socket.data?.userName,
            });
            (0, shadowDispatcher_1.shadowDispatch)(roomId, socket.id, action);
        }
    });
}
// ============================================================================
// EXAMPLE 5: State Queries (Low Risk - Read Only)
// ============================================================================
function setupStateQueryHandlers(socket) {
    socket.on("request:session-status", () => {
        if ((0, featureFlags_1.shouldUseV2)("STATE_QUERIES")) {
            // ✨ V2 HAS AUTHORITY (read state from V2)
            const roomId = (0, actionMapper_1.extractRoomId)(socket, {});
            const room = RoomRegistry_1.roomRegistry.getRoom(roomId);
            if (room) {
                socket.emit("receive:session-status", {
                    active: room.phase !== "LOBBY",
                    phase: room.phase,
                    sessionId: room.sessionId,
                    participants: room.participants.size,
                    timer: room.timer,
                });
            }
            else {
                socket.emit("receive:session-status", {
                    active: false,
                    phase: "LOBBY",
                    sessionId: null,
                    participants: 0,
                    timer: { active: false, remainingMs: 0 },
                });
            }
        }
        else {
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
async function hybridHandler(feature, socket, io, options) {
    const { v1Handler, v2Action, roomId = "default-room", fallbackOnError = true, } = options;
    if ((0, featureFlags_1.shouldUseV2)(feature)) {
        // V2 has authority
        try {
            const effects = (0, dispatch_1.dispatch)(roomId, socket.id, v2Action);
            if ((0, featureFlags_1.shouldExecuteV2Effects)()) {
                (0, runEffects_1.runEffects)(effects, io, RoomRegistry_1.roomRegistry);
            }
            // Return V2 result (you may need to extract from effects or room state)
            const room = RoomRegistry_1.roomRegistry.getRoom(roomId);
            return room; // Customize based on what you need
        }
        catch (error) {
            console.error(`[V2] ${feature} failed:`, error);
            if (fallbackOnError) {
                console.log(`[V2] Falling back to V1 for ${feature}`);
                return await v1Handler();
            }
            throw error;
        }
    }
    else {
        // V1 has authority
        const result = await v1Handler();
        // Shadow observation
        if ((0, featureFlags_1.isShadowModeActive)()) {
            (0, shadowDispatcher_1.shadowDispatch)(roomId, socket.id, v2Action);
        }
        return result;
    }
}
// Usage example:
// await hybridHandler("SESSION_CONTROL", socket, io, {
//   v1Handler: () => startV1Session(durationMinutes),
//   v2Action: { type: "START_SESSION", payload: { durationMinutes } },
// });

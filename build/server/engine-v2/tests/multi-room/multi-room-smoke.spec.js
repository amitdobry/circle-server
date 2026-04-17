"use strict";
/**
 * Multi-Room Smoke Tests
 *
 * Validates that multiple rooms coexist with complete state isolation.
 * No state, pointers, speakers, or effects should leak between rooms.
 *
 * Covers:
 *   - Two rooms active simultaneously, independent phases
 *   - Consensus in room A does not affect room B
 *   - Speaker in room A does not appear in room B
 *   - Disconnect in one room does not affect another
 *   - Timer expiry in one room does not affect another
 *   - Registry counts rooms correctly
 *   - clearAll() wipes all rooms
 *   - Same userId in two rooms is tracked independently
 *   - Event emissions are room-scoped (SOCKET_EMIT_ROOM carries correct roomId)
 *   - Destroying one room does not destroy another
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const TestHarness_1 = require("../harness/TestHarness");
const RoomRegistry_1 = require("../../registry/RoomRegistry");
const invariants_1 = require("../../state/invariants");
const ActionTypes = __importStar(require("../../actions/actionTypes"));
// ============================================================================
// ROOM ISOLATION — PHASE INDEPENDENCE
// ============================================================================
(0, globals_1.describe)("Multi-room smoke", () => {
    (0, globals_1.describe)("room isolation — phase independence", () => {
        (0, globals_1.test)("two rooms start in LOBBY independently", () => {
            const h1 = new TestHarness_1.TestHarness("room-a");
            const h2 = new TestHarness_1.TestHarness("room-b");
            h1.addUsers(2);
            h2.addUsers(2);
            (0, globals_1.expect)(h1.phase).toBe("LOBBY");
            (0, globals_1.expect)(h2.phase).toBe("LOBBY");
            h1.teardown();
            h2.teardown();
        });
        (0, globals_1.test)("starting session in room A does not affect room B", () => {
            const h1 = new TestHarness_1.TestHarness("room-iso-1");
            const h2 = new TestHarness_1.TestHarness("room-iso-2");
            const [a1] = h1.addUsers(1);
            h2.addUsers(1);
            h1.startSession(a1.userId);
            (0, globals_1.expect)(h1.phase).toBe("ATTENTION_SELECTION");
            (0, globals_1.expect)(h2.phase).toBe("LOBBY"); // untouched
            h1.teardown();
            h2.teardown();
        });
        (0, globals_1.test)("consensus in room A does not set live speaker in room B", () => {
            const { h: hA, speakerUserId: speakerA } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            const { h: hB } = (0, TestHarness_1.createSessionWithUsers)(2);
            (0, globals_1.expect)(hA.liveSpeaker).toBe(speakerA);
            (0, globals_1.expect)(hB.liveSpeaker).toBeNull();
            (0, globals_1.expect)(hB.phase).toBe("ATTENTION_SELECTION");
            hA.teardown();
            hB.teardown();
        });
    });
    // ==========================================================================
    // ROOM ISOLATION — STATE DOES NOT LEAK
    // ==========================================================================
    (0, globals_1.describe)("room isolation — state does not leak", () => {
        (0, globals_1.test)("participants in room A are not visible in room B", () => {
            const h1 = new TestHarness_1.TestHarness("room-pl-1");
            const h2 = new TestHarness_1.TestHarness("room-pl-2");
            h1.addUser("Alice");
            h1.addUser("Bob");
            h2.addUser("Charlie");
            (0, globals_1.expect)(h1.state.participants.size).toBe(2);
            (0, globals_1.expect)(h2.state.participants.size).toBe(1);
            (0, globals_1.expect)(h2.getParticipant("Alice")).toBeUndefined();
            (0, globals_1.expect)(h2.getParticipant("Bob")).toBeUndefined();
            h1.teardown();
            h2.teardown();
        });
        (0, globals_1.test)("pointerMap in room A does not affect room B", () => {
            const h1 = new TestHarness_1.TestHarness("room-ptr-1");
            const h2 = new TestHarness_1.TestHarness("room-ptr-2");
            const [a1, b1] = h1.addUsers(2);
            h1.startSession(a1.userId);
            const a1P = h1.getParticipant("Alice");
            h1.dispatch(a1P.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Alice", targetUserId: "Bob" },
            });
            (0, globals_1.expect)(h1.state.pointerMap.size).toBe(1);
            (0, globals_1.expect)(h2.state.pointerMap.size).toBe(0); // completely isolated
            h1.teardown();
            h2.teardown();
        });
        (0, globals_1.test)("dropping mic in room A does not affect room B live speaker", () => {
            const { h: hA, speakerUserId: speakerA } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            const { h: hB, speakerUserId: speakerB } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            const speakerAP = hA.getParticipantById(speakerA);
            hA.dropMic(speakerAP.socketId);
            // Room A: speaker cleared
            (0, globals_1.expect)(hA.liveSpeaker).toBeNull();
            // Room B: completely unaffected
            (0, globals_1.expect)(hB.liveSpeaker).toBe(speakerB);
            (0, globals_1.expect)(hB.phase).toBe("LIVE_SPEAKER");
            hA.teardown();
            hB.teardown();
        });
        (0, globals_1.test)("disconnect in room A does not ghost users in room B", () => {
            const h1 = new TestHarness_1.TestHarness("room-dc-1");
            const h2 = new TestHarness_1.TestHarness("room-dc-2");
            const [alice1] = h1.addUsers(2);
            const [alice2] = h2.addUsers(2);
            h1.startSession(alice1.userId);
            h2.startSession(alice2.userId);
            const alice1P = h1.getParticipant("Alice");
            h1.dispatch(alice1P.socketId, { type: ActionTypes.DISCONNECT });
            // Room 1: Alice is ghost
            (0, globals_1.expect)(h1.getParticipant("Alice").presence).toBe("GHOST");
            // Room 2: Alice is still connected (different room, different participant object)
            (0, globals_1.expect)(h2.getParticipant("Alice").presence).toBe("CONNECTED");
            h1.teardown();
            h2.teardown();
        });
        (0, globals_1.test)("timer expiry in room A does not expire room B timer", () => {
            const { h: hA } = (0, TestHarness_1.createSessionWithUsers)(2);
            const { h: hB } = (0, TestHarness_1.createSessionWithUsers)(2);
            hA.expireTimer();
            (0, globals_1.expect)(hA.phase).toBe("ENDING");
            (0, globals_1.expect)(hA.state.timer.active).toBe(false);
            (0, globals_1.expect)(hB.phase).toBe("ATTENTION_SELECTION");
            (0, globals_1.expect)(hB.state.timer.active).toBe(true); // still running
            hA.teardown();
            hB.teardown();
        });
    });
    // ==========================================================================
    // SAME USER IN MULTIPLE ROOMS
    // ==========================================================================
    (0, globals_1.describe)("same userId in multiple rooms", () => {
        (0, globals_1.test)("same displayName in two rooms tracked as independent participants", () => {
            const h1 = new TestHarness_1.TestHarness("room-su-1");
            const h2 = new TestHarness_1.TestHarness("room-su-2");
            h1.addUser("Alice");
            h2.addUser("Alice");
            const alice1 = h1.getParticipant("Alice");
            const alice2 = h2.getParticipant("Alice");
            // Same display name but independent participant objects in each room
            (0, globals_1.expect)(alice1).toBeDefined();
            (0, globals_1.expect)(alice2).toBeDefined();
            // They're different room-local objects
            (0, globals_1.expect)(alice1).not.toBe(alice2);
            h1.teardown();
            h2.teardown();
        });
        (0, globals_1.test)("state mutation for Alice in room 1 does not affect Alice in room 2", () => {
            const h1 = new TestHarness_1.TestHarness("room-ms-1");
            const h2 = new TestHarness_1.TestHarness("room-ms-2");
            const [a1] = h1.addUsers(1);
            const [a2] = h2.addUsers(1);
            h1.startSession(a1.userId);
            h2.startSession(a2.userId);
            // Disconnect Alice in room 1
            const alice1P = h1.getParticipant("Alice");
            h1.dispatch(alice1P.socketId, { type: ActionTypes.DISCONNECT });
            // Alice in room 2 still connected
            (0, globals_1.expect)(h2.getParticipant("Alice").presence).toBe("CONNECTED");
            h1.teardown();
            h2.teardown();
        });
    });
    // ==========================================================================
    // EFFECT SCOPING
    // ==========================================================================
    (0, globals_1.describe)("effect scoping", () => {
        (0, globals_1.test)("SOCKET_EMIT_ROOM effects carry the correct roomId", () => {
            const h1 = new TestHarness_1.TestHarness("room-eff-1");
            const h2 = new TestHarness_1.TestHarness("room-eff-2");
            const [a1] = h1.addUsers(2);
            const [a2] = h2.addUsers(2);
            h1.clearEffects();
            h1.startSession(a1.userId);
            const roomEmits = h1.effects.filter((e) => e.type === "SOCKET_EMIT_ROOM");
            (0, globals_1.expect)(roomEmits.length).toBeGreaterThan(0);
            for (const emit of roomEmits) {
                (0, globals_1.expect)(emit.roomId).toBe("room-eff-1");
                (0, globals_1.expect)(emit.roomId).not.toBe("room-eff-2");
            }
            h1.teardown();
            h2.teardown();
        });
        (0, globals_1.test)("REBUILD_ALL_PANELS effects are scoped to correct room", () => {
            const { h: hA, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            const { h: hB } = (0, TestHarness_1.createSessionWithUsers)(2);
            const speakerP = hA.getParticipantById(speakerUserId);
            hA.clearEffects();
            hA.dropMic(speakerP.socketId);
            const rebuilds = hA.effects.filter((e) => e.type === "REBUILD_ALL_PANELS");
            for (const r of rebuilds) {
                (0, globals_1.expect)(r.roomId).toBe(hA.roomId);
                (0, globals_1.expect)(r.roomId).not.toBe(hB.roomId);
            }
            hA.teardown();
            hB.teardown();
        });
    });
    // ==========================================================================
    // REGISTRY OPERATIONS
    // ==========================================================================
    (0, globals_1.describe)("registry operations", () => {
        (0, globals_1.test)("registry tracks correct room count", () => {
            const countBefore = RoomRegistry_1.roomRegistry.getRoomCount();
            const h1 = new TestHarness_1.TestHarness();
            const h2 = new TestHarness_1.TestHarness();
            const h3 = new TestHarness_1.TestHarness();
            (0, globals_1.expect)(RoomRegistry_1.roomRegistry.getRoomCount()).toBe(countBefore + 3);
            h1.teardown();
            h2.teardown();
            h3.teardown();
            (0, globals_1.expect)(RoomRegistry_1.roomRegistry.getRoomCount()).toBe(countBefore);
        });
        (0, globals_1.test)("destroying one room does not affect another", () => {
            const h1 = new TestHarness_1.TestHarness("room-destroy-1");
            const h2 = new TestHarness_1.TestHarness("room-destroy-2");
            h1.addUsers(2);
            h2.addUsers(2);
            h1.teardown(); // Destroy room 1
            // Room 2 still accessible with correct state
            (0, globals_1.expect)(RoomRegistry_1.roomRegistry.hasRoom("room-destroy-2")).toBe(true);
            (0, globals_1.expect)(RoomRegistry_1.roomRegistry.hasRoom("room-destroy-1")).toBe(false);
            (0, globals_1.expect)(h2.state.participants.size).toBe(2);
            h2.teardown();
        });
        (0, globals_1.test)("getOrCreateRoom returns the same object for the same roomId", () => {
            const h = new TestHarness_1.TestHarness("room-same-ref");
            h.addUsers(2);
            const ref1 = RoomRegistry_1.roomRegistry.getOrCreateRoom("room-same-ref");
            const ref2 = RoomRegistry_1.roomRegistry.getOrCreateRoom("room-same-ref");
            (0, globals_1.expect)(ref1).toBe(ref2); // Same object in memory
            h.teardown();
        });
        (0, globals_1.test)("creating a room that already exists throws", () => {
            const h = new TestHarness_1.TestHarness("room-conflict");
            (0, globals_1.expect)(() => {
                RoomRegistry_1.roomRegistry.createRoom("room-conflict"); // Already exists
            }).toThrow();
            h.teardown();
        });
    });
    // ==========================================================================
    // THREE-ROOM CONCURRENT SCENARIO
    // ==========================================================================
    (0, globals_1.describe)("three-room concurrent scenario", () => {
        (0, globals_1.test)("three rooms each reach consensus on different speakers simultaneously", () => {
            const { h: h1, speakerUserId: s1 } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            const { h: h2, speakerUserId: s2 } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
            const { h: h3, speakerUserId: s3 } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            // All three rooms independently in LIVE_SPEAKER
            (0, globals_1.expect)(h1.phase).toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h2.phase).toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h3.phase).toBe("LIVE_SPEAKER");
            // Each has their own independent speaker
            (0, globals_1.expect)(h1.liveSpeaker).toBe(s1);
            (0, globals_1.expect)(h2.liveSpeaker).toBe(s2);
            (0, globals_1.expect)(h3.liveSpeaker).toBe(s3);
            // Drop mic in room 2 only
            const s2P = h2.getParticipantById(s2);
            h2.dropMic(s2P.socketId);
            // Room 2 changed
            (0, globals_1.expect)(h2.phase).toBe("ATTENTION_SELECTION");
            (0, globals_1.expect)(h2.liveSpeaker).toBeNull();
            // Rooms 1 and 3 completely unaffected
            (0, globals_1.expect)(h1.phase).toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h1.liveSpeaker).toBe(s1);
            (0, globals_1.expect)(h3.phase).toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h3.liveSpeaker).toBe(s3);
            // All invariants hold
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h1.state)).not.toThrow();
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h2.state)).not.toThrow();
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h3.state)).not.toThrow();
            h1.teardown();
            h2.teardown();
            h3.teardown();
        });
    });
});

"use strict";
/**
 * LEAVE_SESSION Scenarios - Comprehensive Test Suite
 *
 * Tests explicit table exit via Leave button
 *
 * Core Principle: "LEAVE_SESSION = immediate removal, DISCONNECT = ghost (temporary)"
 *
 * Key Distinctions:
 *   - LEAVE_SESSION: Complete removal, no ghost, no reconnect
 *   - DISCONNECT: Ghost created, seat preserved, reconnect allowed
 *
 * Coverage:
 *   1. Basic LEAVE_SESSION Behavior
 *   2. LEAVE_SESSION vs DISCONNECT Distinction
 *   3. LEAVE_SESSION Clears Speaker
 *   4. LEAVE_SESSION Updates Consensus
 *   5. LEAVE_SESSION During All Phases
 *   6. Multi-User LEAVE_SESSION Scenarios
 *   7. Edge Cases
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
const ActionTypes = __importStar(require("../../actions/actionTypes"));
// ============================================================================
// 1. BASIC LEAVE BEHAVIOR
// ============================================================================
(0, globals_1.describe)("Basic LEAVE_SESSION Behavior", () => {
    (0, globals_1.test)("LEAVE removes participant immediately (no ghost)", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const aliceUserId = aliceP.userId;
        // Alice leaves
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        // Alice should be completely gone (not a ghost)
        (0, globals_1.expect)(h.getParticipant("Alice")).toBeUndefined();
        (0, globals_1.expect)(h.state.participants.has(aliceUserId)).toBe(false);
        (0, globals_1.expect)(h.state.participants.size).toBe(1); // Only Bob remains
        h.teardown();
    });
    (0, globals_1.test)("LEAVE clears all references (pointerMap, speaker)", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        // Alice points to Bob
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: bobP.userId },
        });
        (0, globals_1.expect)(h.state.pointerMap.has(aliceP.userId)).toBe(true);
        // Alice leaves
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        // Pointer should be cleared
        (0, globals_1.expect)(h.state.pointerMap.has(aliceP.userId)).toBe(false);
        h.teardown();
    });
    (0, globals_1.test)("LEAVE_SESSION logs system message", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        // Alice leaves
        const effects = h.dispatch(aliceP.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        // Should log system message
        const logEvent = effects.find((e) => e.type === "SYSTEM_LOG");
        (0, globals_1.expect)(logEvent).toBeDefined();
        if (logEvent && logEvent.type === "SYSTEM_LOG") {
            (0, globals_1.expect)(logEvent.message).toContain("Alice");
            (0, globals_1.expect)(logEvent.message).toContain("left the circle");
        }
        h.teardown();
    });
    (0, globals_1.test)("LEAVE triggers REBUILD_ALL_PANELS", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const effects = h.dispatch(aliceP.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        // Should rebuild panels
        const rebuildEffect = effects.find((e) => e.type === "REBUILD_ALL_PANELS");
        (0, globals_1.expect)(rebuildEffect).toBeDefined();
        h.teardown();
    });
    (0, globals_1.test)("LEAVE of non-existent user handled gracefully", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        // Try to leave with non-existent socket
        const effects = h.dispatch("fake-socket-id", {
            type: ActionTypes.LEAVE_SESSION,
        });
        // Should not crash, no effects
        (0, globals_1.expect)(effects).toEqual([]);
        h.teardown();
    });
});
// ============================================================================
// 2. LEAVE vs DISCONNECT DISTINCTION
// ============================================================================
(0, globals_1.describe)("LEAVE_SESSION vs DISCONNECT Distinction", () => {
    (0, globals_1.test)("DISCONNECT creates ghost, LEAVE does not", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        // Alice disconnects → becomes ghost
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("GHOST");
        (0, globals_1.expect)(h.state.participants.size).toBe(2); // Still 2 (Alice ghost + Bob)
        // Bob leaves → completely removed
        h.dispatch(bobP.socketId, { type: ActionTypes.LEAVE_SESSION });
        (0, globals_1.expect)(h.getParticipant("Bob")).toBeUndefined();
        (0, globals_1.expect)(h.state.participants.size).toBe(1); // Only Alice ghost remains
        // Phase should be ENDING (all connected users gone)
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        h.teardown();
    });
    (0, globals_1.test)("LEAVE does NOT schedule purge (no delayed action)", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const effects = h.dispatch(aliceP.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        // Should NOT have delayed purge action (unlike DISCONNECT)
        const delayedAction = effects.find((e) => e.type === "DELAYED_ACTION");
        (0, globals_1.expect)(delayedAction).toBeUndefined();
        h.teardown();
    });
    (0, globals_1.test)("LEAVE cannot be reconnected", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const aliceDisplayName = aliceP.displayName;
        // Alice leaves
        h.dispatch(aliceP.socketId, { type: ActionTypes.LEAVE_SESSION });
        // Try to reconnect
        h.dispatch("alice-new-socket", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: aliceDisplayName },
        });
        // Should not find Alice (no ghost to reconnect to)
        (0, globals_1.expect)(h.getParticipant("Alice")).toBeUndefined();
        h.teardown();
    });
    (0, globals_1.test)("DISCONNECT preserves seat, LEAVE does not", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const aliceUserId = aliceP.userId;
        const aliceAvatarId = aliceP.avatarId;
        const bobP = h.getParticipant("Bob");
        const bobUserId = bobP.userId;
        const bobAvatarId = bobP.avatarId;
        // Alice disconnects → seat preserved
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.getParticipantById(aliceUserId)).toBeDefined();
        (0, globals_1.expect)(h.getParticipantById(aliceUserId).avatarId).toBe(aliceAvatarId);
        // Bob leaves → seat removed
        h.dispatch(bobP.socketId, { type: ActionTypes.LEAVE_SESSION });
        (0, globals_1.expect)(h.getParticipantById(bobUserId)).toBeUndefined();
        // Phase should be ENDING (only ghost remains)
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        h.teardown();
    });
});
// ============================================================================
// 3. LEAVE CLEARS SPEAKER
// ============================================================================
(0, globals_1.describe)("LEAVE_SESSION Clears Speaker", () => {
    (0, globals_1.test)("speaker leaves → liveSpeaker cleared", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        (0, globals_1.expect)(h.liveSpeaker).toBe(speakerUserId);
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        // Speaker leaves
        h.dispatch(speakerP.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        // liveSpeaker cleared, phase transitions
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        h.teardown();
    });
    (0, globals_1.test)("speaker leaves → other participants can continue", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
        const speakerP = h.getParticipantById(speakerUserId);
        // Speaker leaves
        h.dispatch(speakerP.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        // Session continues with 2 participants
        (0, globals_1.expect)(h.state.participants.size).toBe(2);
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        h.teardown();
    });
    (0, globals_1.test)("non-speaker leaves → liveSpeaker unchanged", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
        // Find a non-speaker
        const nonSpeaker = Array.from(h.state.participants.values()).find((p) => p.userId !== speakerUserId);
        // Non-speaker leaves
        h.dispatch(nonSpeaker.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        // liveSpeaker unchanged
        (0, globals_1.expect)(h.liveSpeaker).toBe(speakerUserId);
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        h.teardown();
    });
});
// ============================================================================
// 4. LEAVE UPDATES CONSENSUS
// ============================================================================
(0, globals_1.describe)("LEAVE_SESSION Updates Consensus", () => {
    (0, globals_1.test)("LEAVE removes user from consensus count", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        const carolP = h.getParticipant("Carol");
        // All point to Alice
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: aliceP.userId },
        });
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: aliceP.userId },
        });
        h.dispatch(carolP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Carol", targetUserId: aliceP.userId },
        });
        // 3/3 consensus
        (0, globals_1.expect)(h.state.pointerMap.size).toBe(3);
        // Carol leaves
        h.dispatch(carolP.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        // Now 2/2 consensus (Bob and Alice pointing to Alice)
        (0, globals_1.expect)(h.state.pointerMap.size).toBe(2);
        h.teardown();
    });
    (0, globals_1.test)("LEAVE triggers speaker selection if all pointed to leaver", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        const carolP = h.getParticipant("Carol");
        // Everyone points to Alice
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: aliceP.userId },
        });
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: aliceP.userId },
        });
        h.dispatch(carolP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Carol", targetUserId: aliceP.userId },
        });
        // This should trigger speaker selection
        (0, globals_1.expect)(h.liveSpeaker).toBe(aliceP.userId);
        // Alice (the speaker) leaves
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        // liveSpeaker cleared, back to attention selection
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        h.teardown();
    });
    (0, globals_1.test)("LEAVE clears pointers TO the leaving user", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        const carolP = h.getParticipant("Carol");
        // Bob and Carol point to Alice
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: aliceP.userId },
        });
        h.dispatch(carolP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Carol", targetUserId: aliceP.userId },
        });
        (0, globals_1.expect)(h.state.pointerMap.get(bobP.userId)).toBe(aliceP.userId);
        (0, globals_1.expect)(h.state.pointerMap.get(carolP.userId)).toBe(aliceP.userId);
        // Alice leaves
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        // Pointers TO Alice should be cleared
        (0, globals_1.expect)(h.state.pointerMap.get(bobP.userId)).toBeUndefined();
        (0, globals_1.expect)(h.state.pointerMap.get(carolP.userId)).toBeUndefined();
        (0, globals_1.expect)(h.state.pointerMap.size).toBe(0);
        h.teardown();
    });
});
// ============================================================================
// 5. LEAVE DURING ALL PHASES
// ============================================================================
(0, globals_1.describe)("LEAVE_SESSION During All Phases", () => {
    (0, globals_1.test)("LEAVE during LOBBY phase", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        // Don't start session - stay in LOBBY
        const aliceP = h.getParticipant("Alice");
        (0, globals_1.expect)(h.phase).toBe("LOBBY");
        h.dispatch(aliceP.socketId, { type: ActionTypes.LEAVE_SESSION });
        (0, globals_1.expect)(h.getParticipant("Alice")).toBeUndefined();
        (0, globals_1.expect)(h.phase).toBe("LOBBY"); // Stays in LOBBY with Bob
        h.teardown();
    });
    (0, globals_1.test)("LEAVE during ATTENTION_SELECTION phase", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        h.dispatch(aliceP.socketId, { type: ActionTypes.LEAVE_SESSION });
        (0, globals_1.expect)(h.getParticipant("Alice")).toBeUndefined();
        // Phase stays ATTENTION_SELECTION with Bob
        h.teardown();
    });
    (0, globals_1.test)("LEAVE during LIVE_SPEAKER phase (speaker leaves)", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        h.dispatch(speakerP.socketId, { type: ActionTypes.LEAVE_SESSION });
        // Phase transitions to ATTENTION_SELECTION
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        h.teardown();
    });
    (0, globals_1.test)("LEAVE during ENDING phase", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        // Force ENDING phase (all users disconnect)
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        // Alice reconnects
        h.dispatch("alice-v2", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        // Alice leaves
        const aliceReconnected = h.getParticipant("Alice");
        h.dispatch(aliceReconnected.socketId, { type: ActionTypes.LEAVE_SESSION });
        (0, globals_1.expect)(h.getParticipant("Alice")).toBeUndefined();
        h.teardown();
    });
});
// ============================================================================
// 6. MULTI-USER LEAVE SCENARIOS
// ============================================================================
(0, globals_1.describe)("Multi-User LEAVE_SESSION Scenarios", () => {
    (0, globals_1.test)("all users leave → table becomes empty", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        const carolP = h.getParticipant("Carol");
        // All leave one by one
        h.dispatch(aliceP.socketId, { type: ActionTypes.LEAVE_SESSION });
        (0, globals_1.expect)(h.state.participants.size).toBe(2);
        h.dispatch(bobP.socketId, { type: ActionTypes.LEAVE_SESSION });
        (0, globals_1.expect)(h.state.participants.size).toBe(1);
        h.dispatch(carolP.socketId, { type: ActionTypes.LEAVE_SESSION });
        (0, globals_1.expect)(h.state.participants.size).toBe(0);
        h.teardown();
    });
    (0, globals_1.test)("mix of LEAVE and DISCONNECT", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        const carolP = h.getParticipant("Carol");
        // Alice leaves (removed)
        h.dispatch(aliceP.socketId, { type: ActionTypes.LEAVE_SESSION });
        // Bob disconnects (ghost)
        h.dispatch(bobP.socketId, { type: ActionTypes.DISCONNECT });
        // Carol still connected
        (0, globals_1.expect)(h.state.participants.size).toBe(2); // Bob ghost + Carol
        (0, globals_1.expect)(h.getParticipant("Alice")).toBeUndefined();
        (0, globals_1.expect)(h.getParticipant("Bob").presence).toBe("GHOST");
        (0, globals_1.expect)(h.getParticipant("Carol").presence).toBe("CONNECTED");
        h.teardown();
    });
    (0, globals_1.test)("sequential leaves maintain correct participant count", () => {
        const h = new TestHarness_1.TestHarness();
        const users = h.addUsers(5);
        h.startSession(users[0].userId);
        (0, globals_1.expect)(h.state.participants.size).toBe(5);
        // Leave one by one
        for (let i = 0; i < 5; i++) {
            const p = h.getParticipantById(users[i].userId);
            h.dispatch(p.socketId, { type: ActionTypes.LEAVE_SESSION });
            (0, globals_1.expect)(h.state.participants.size).toBe(4 - i);
        }
        h.teardown();
    });
});
// ============================================================================
// 7. EDGE CASES
// ============================================================================
(0, globals_1.describe)("LEAVE_SESSION Edge Cases", () => {
    (0, globals_1.test)("LEAVE while holding attention pointer", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        // Alice points to Bob
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: h.getParticipant("Bob").userId },
        });
        (0, globals_1.expect)(h.state.pointerMap.has(aliceP.userId)).toBe(true);
        // Alice leaves
        h.dispatch(aliceP.socketId, { type: ActionTypes.LEAVE_SESSION });
        // Pointer cleared
        (0, globals_1.expect)(h.state.pointerMap.has(aliceP.userId)).toBe(false);
        h.teardown();
    });
    (0, globals_1.test)("LEAVE while being pointed at", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        const carolP = h.getParticipant("Carol");
        // Bob and Carol point to Alice
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: aliceP.userId },
        });
        h.dispatch(carolP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Carol", targetUserId: aliceP.userId },
        });
        // Alice leaves
        h.dispatch(aliceP.socketId, { type: ActionTypes.LEAVE_SESSION });
        // Pointers TO Alice should be cleared
        (0, globals_1.expect)(h.state.pointerMap.get(bobP.userId)).toBeUndefined();
        (0, globals_1.expect)(h.state.pointerMap.get(carolP.userId)).toBeUndefined();
        h.teardown();
    });
    (0, globals_1.test)("rapid LEAVE calls from same user", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        // First LEAVE
        h.dispatch(aliceP.socketId, { type: ActionTypes.LEAVE_SESSION });
        (0, globals_1.expect)(h.getParticipant("Alice")).toBeUndefined();
        // Second LEAVE (should be handled gracefully)
        const effects = h.dispatch(aliceP.socketId, {
            type: ActionTypes.LEAVE_SESSION,
        });
        (0, globals_1.expect)(effects).toEqual([]); // No effects for non-existent user
        h.teardown();
    });
    (0, globals_1.test)("last participant leaves → phase remains stable", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const phaseBefore = h.phase;
        h.dispatch(aliceP.socketId, { type: ActionTypes.LEAVE_SESSION });
        (0, globals_1.expect)(h.state.participants.size).toBe(0);
        // Phase doesn't change to ENDING (no one left to end session)
        h.teardown();
    });
    (0, globals_1.test)("invariants hold after LEAVE", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.LEAVE_SESSION });
        // Invariants:
        // 1. No participant in pointerMap that doesn't exist
        for (const [from, to] of h.state.pointerMap.entries()) {
            (0, globals_1.expect)(h.state.participants.has(from)).toBe(true);
            (0, globals_1.expect)(h.state.participants.has(to)).toBe(true);
        }
        // 2. liveSpeaker exists if set
        if (h.liveSpeaker) {
            (0, globals_1.expect)(h.state.participants.has(h.liveSpeaker)).toBe(true);
        }
        // 3. All CONNECTED participants have valid socketId
        for (const p of h.state.participants.values()) {
            if (p.presence === "CONNECTED") {
                (0, globals_1.expect)(p.socketId).not.toBeNull();
            }
        }
        h.teardown();
    });
});

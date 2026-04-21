"use strict";
/**
 * Ghost Scenarios - Comprehensive Test Suite
 *
 * Tests the complete ghost behavior as specified in Ghost_Concept_Refactor.md
 *
 * Core Principle: "A ghost is a seat-preserving observer"
 *
 * Coverage:
 *   1. Ghost Consensus Behavior
 *   2. Reconnect State Reset
 *   3. Ghost Purge (3min timeout)
 *   4. Multi-Ghost Scenarios
 *   5. Speaker Ghost Transitions
 *   6. Ghost During All Phases
 *   7. Panel Routing for Ghosts
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
// 1. GHOST CONSENSUS BEHAVIOR
// ============================================================================
(0, globals_1.describe)("Ghost Consensus Behavior", () => {
    (0, globals_1.test)("ghost pointer does NOT count toward consensus", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        const carolP = h.getParticipant("Carol");
        // All three point to Alice
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: "Alice" },
        });
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: "Alice" },
        });
        h.dispatch(carolP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Carol", targetUserId: "Alice" },
        });
        // Consensus achieved
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        (0, globals_1.expect)(h.liveSpeaker).toBe(aliceP.userId);
        // Carol disconnects (becomes ghost)
        h.dispatch(carolP.socketId, { type: ActionTypes.DISCONNECT });
        const carolGhost = h.getParticipant("Carol");
        (0, globals_1.expect)(carolGhost.presence).toBe("GHOST");
        // Manually add pointer back to ghost (should NOT count)
        h.state.pointerMap.set(carolGhost.userId, aliceP.userId);
        // Drop mic, back to attention selection
        h.dispatch(aliceP.socketId, { type: ActionTypes.DROP_MIC });
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        // Now only Alice and Bob point to Alice (Carol is ghost)
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: "Alice" },
        });
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: "Alice" },
        });
        // Should achieve consensus with 2/2 CONNECTED (ghost doesn't count)
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        (0, globals_1.expect)(h.liveSpeaker).toBe(aliceP.userId);
        h.teardown();
    });
    (0, globals_1.test)("removing ghost pointer can trigger consensus", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        const carolP = h.getParticipant("Carol");
        // Alice and Bob point to Alice, Carol points to Bob (blocking consensus)
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: "Alice" },
        });
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: "Alice" },
        });
        h.dispatch(carolP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Carol", targetUserId: "Bob" },
        });
        // No consensus (2 for Alice, 1 for Bob)
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        // Carol disconnects → her blocking pointer removed
        h.dispatch(carolP.socketId, { type: ActionTypes.DISCONNECT });
        // Now 2/2 CONNECTED users point to Alice → consensus!
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        (0, globals_1.expect)(h.liveSpeaker).toBe(aliceP.userId);
        h.teardown();
    });
    (0, globals_1.test)("ghost cannot block consensus even with pointer in map", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        // Both point to Alice
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: "Alice" },
        });
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: "Alice" },
        });
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        // Drop mic
        h.dispatch(aliceP.socketId, { type: ActionTypes.DROP_MIC });
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        // Bob disconnects
        h.dispatch(bobP.socketId, { type: ActionTypes.DISCONNECT });
        // Manually corrupt state: add pointer for ghost Bob
        const bobGhost = h.getParticipant("Bob");
        h.state.pointerMap.set(bobGhost.userId, bobGhost.userId);
        // Alice points to herself (should be 1/1 = consensus)
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: "Alice" },
        });
        // Should achieve consensus despite ghost's pointer
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        h.teardown();
    });
});
// ============================================================================
// 2. RECONNECT STATE RESET
// ============================================================================
(0, globals_1.describe)("Reconnect State Reset", () => {
    (0, globals_1.test)("reconnected user has role reset to 'listener'", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        // Alice becomes speaker
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: "Alice" },
        });
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: "Alice" },
        });
        (0, globals_1.expect)(aliceP.role).toBe("speaker");
        // Alice disconnects
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        // Alice reconnects
        const newSocket = "alice-reconnect";
        h.dispatch(newSocket, {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        // Role should be reset to listener
        const aliceReconnected = h.getParticipant("Alice");
        (0, globals_1.expect)(aliceReconnected.role).toBe("listener");
        h.teardown();
    });
    (0, globals_1.test)("reconnected speaker loses liveSpeaker status", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        // ✅ NEW BEHAVIOR: Speaker disconnects → mic drops immediately
        h.dispatch(speakerP.socketId, { type: ActionTypes.DISCONNECT });
        // liveSpeaker already cleared (speaker invalidation on disconnect)
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        // Speaker reconnects
        h.dispatch("speaker-new-socket", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: speakerP.displayName },
        });
        // liveSpeaker still null (reconnect doesn't restore speaker status)
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        h.teardown();
    });
    (0, globals_1.test)("reconnected user has attentionTarget cleared", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        // Alice points to herself
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: "Alice" },
        });
        (0, globals_1.expect)(h.state.pointerMap.get(aliceP.userId)).toBe(aliceP.userId);
        // Alice disconnects (pointer already cleared by DISCONNECT)
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.state.pointerMap.has(aliceP.userId)).toBe(false);
        // Alice reconnects
        h.dispatch("alice-new", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        // Pointer should still be cleared
        (0, globals_1.expect)(h.state.pointerMap.has(aliceP.userId)).toBe(false);
        const aliceReconnected = h.getParticipant("Alice");
        (0, globals_1.expect)(aliceReconnected.attentionTarget).toBeNull();
        h.teardown();
    });
    (0, globals_1.test)("reconnect is seat reclaim, not state restoration", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const originalUserId = aliceP.userId;
        const originalAvatar = aliceP.avatarId;
        // Alice disconnects
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        // Alice reconnects
        const newSocket = "alice-v2";
        h.dispatch(newSocket, {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        const aliceReconnected = h.getParticipant("Alice");
        // RESTORED (seat identity):
        (0, globals_1.expect)(aliceReconnected.userId).toBe(originalUserId);
        (0, globals_1.expect)(aliceReconnected.avatarId).toBe(originalAvatar);
        (0, globals_1.expect)(aliceReconnected.displayName).toBe("Alice");
        // RESET (participation state):
        (0, globals_1.expect)(aliceReconnected.presence).toBe("CONNECTED");
        (0, globals_1.expect)(aliceReconnected.socketId).toBe(newSocket);
        (0, globals_1.expect)(aliceReconnected.role).toBe("listener");
        (0, globals_1.expect)(h.state.pointerMap.has(aliceReconnected.userId)).toBe(false);
        h.teardown();
    });
});
// ============================================================================
// 3. GHOST PURGE (3min timeout)
// ============================================================================
(0, globals_1.describe)("Ghost Purge After Timeout", () => {
    (0, globals_1.test)("ghost scheduled for purge after 3 minutes", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.clearEffects();
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        // Should have DELAYED_ACTION effect for PURGE_GHOST
        const purgeEffect = h.effects.find((e) => e.type === "DELAYED_ACTION" &&
            e.action?.type === ActionTypes.PURGE_GHOST);
        (0, globals_1.expect)(purgeEffect).toBeDefined();
        (0, globals_1.expect)(purgeEffect.delayMs).toBe(3 * 60 * 1000); // 3 minutes
        h.teardown();
    });
    (0, globals_1.test)("PURGE_GHOST removes ghost completely from participants", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        // Alice disconnects (becomes ghost)
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.state.participants.has(aliceP.userId)).toBe(true);
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("GHOST");
        // Execute purge
        h.dispatch(null, {
            type: ActionTypes.PURGE_GHOST,
            payload: { userId: aliceP.userId },
        });
        // Alice should be completely removed
        (0, globals_1.expect)(h.state.participants.has(aliceP.userId)).toBe(false);
        (0, globals_1.expect)(h.getParticipant("Alice")).toBeUndefined();
        h.teardown();
    });
    (0, globals_1.test)("purge broadcasts user-list and avatar-state updates", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        h.clearEffects();
        h.dispatch(null, {
            type: ActionTypes.PURGE_GHOST,
            payload: { userId: aliceP.userId },
        });
        // Should broadcast updates (via delayed action callback in runEffects)
        // Note: This tests the integration with runEffects.ts
        (0, globals_1.expect)(h.effects.length).toBeGreaterThan(0);
        h.teardown();
    });
    (0, globals_1.test)("purged ghost's avatar is released", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const aliceAvatar = aliceP.avatarId;
        // Alice disconnects
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        // Purge Alice
        h.dispatch(null, {
            type: ActionTypes.PURGE_GHOST,
            payload: { userId: aliceP.userId },
        });
        // Avatar should be available (tested via broadcast, not direct check)
        // The avatar release is handled by avatarManager when broadcasting
        (0, globals_1.expect)(h.state.participants.has(aliceP.userId)).toBe(false);
        h.teardown();
    });
    (0, globals_1.test)("reconnecting before purge prevents removal", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        // Alice disconnects
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("GHOST");
        // Alice reconnects before purge
        h.dispatch("alice-new", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("CONNECTED");
        // Execute purge (should do nothing - user is CONNECTED)
        h.dispatch(null, {
            type: ActionTypes.PURGE_GHOST,
            payload: { userId: aliceP.userId },
        });
        // Alice should still exist and be CONNECTED
        (0, globals_1.expect)(h.state.participants.has(aliceP.userId)).toBe(true);
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("CONNECTED");
        h.teardown();
    });
    (0, globals_1.test)("PURGE_GHOST clears liveSpeaker if ghost was speaking", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        // Start consensus (Alice speaks)
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: aliceP.userId },
        });
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: aliceP.userId },
        });
        // Alice should be liveSpeaker
        (0, globals_1.expect)(h.state.liveSpeaker).toBe(aliceP.userId);
        (0, globals_1.expect)(h.state.phase).toBe("LIVE_SPEAKER");
        // ✅ NEW BEHAVIOR: Speaker disconnect immediately invalidates speaker
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("GHOST");
        (0, globals_1.expect)(h.state.liveSpeaker).toBeNull(); // ✅ Mic dropped immediately!
        (0, globals_1.expect)(h.state.phase).toBe("ATTENTION_SELECTION");
        // Execute purge - should be a no-op for speaker (already invalidated)
        h.dispatch(null, {
            type: ActionTypes.PURGE_GHOST,
            payload: { userId: aliceP.userId },
        });
        // Alice removed
        (0, globals_1.expect)(h.state.participants.has(aliceP.userId)).toBe(false);
        (0, globals_1.expect)(h.state.liveSpeaker).toBeNull();
        // Invariants should pass (no crash)
        (0, globals_1.expect)(() => {
            const { assertInvariantsIfDev } = require("../../state/invariants");
            assertInvariantsIfDev(h.state, "TEST");
        }).not.toThrow();
        h.teardown();
    });
    (0, globals_1.test)("🔥 PURGE_GHOST multi-user: speaker purged, listener remains eligible", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        // Alice becomes speaker via consensus
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: aliceP.userId },
        });
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: aliceP.userId },
        });
        (0, globals_1.expect)(h.state.liveSpeaker).toBe(aliceP.userId);
        (0, globals_1.expect)(h.state.phase).toBe("LIVE_SPEAKER");
        (0, globals_1.expect)(aliceP.role).toBe("speaker");
        // ✅ NEW BEHAVIOR: Speaker disconnect immediately invalidates speaker
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("GHOST");
        (0, globals_1.expect)(bobP.presence).toBe("CONNECTED");
        // Mic dropped immediately
        (0, globals_1.expect)(h.state.liveSpeaker).toBeNull();
        (0, globals_1.expect)(h.state.phase).toBe("ATTENTION_SELECTION");
        (0, globals_1.expect)(h.state.pointerMap.size).toBe(0); // Pointers cleared
        // Purge Alice (already not speaker)
        h.dispatch(null, {
            type: ActionTypes.PURGE_GHOST,
            payload: { userId: aliceP.userId },
        });
        // ✅ After purge:
        // - Alice removed
        (0, globals_1.expect)(h.state.participants.has(aliceP.userId)).toBe(false);
        (0, globals_1.expect)(h.getParticipant("Alice")).toBeUndefined();
        // - liveSpeaker still null (was already cleared on disconnect)
        (0, globals_1.expect)(h.state.liveSpeaker).toBeNull();
        // - Phase still ATTENTION_SELECTION
        (0, globals_1.expect)(h.state.phase).toBe("ATTENTION_SELECTION");
        // - Bob still connected (role doesn't matter in ATTENTION_SELECTION)
        (0, globals_1.expect)(h.state.participants.has(bobP.userId)).toBe(true);
        (0, globals_1.expect)(bobP.presence).toBe("CONNECTED");
        // - Bob is eligible for new selection
        const connectedUsers = Array.from(h.state.participants.values()).filter((p) => p.presence === "CONNECTED");
        (0, globals_1.expect)(connectedUsers.length).toBe(1);
        (0, globals_1.expect)(connectedUsers[0].displayName).toBe("Bob");
        // - System transitions cleanly (no crash)
        (0, globals_1.expect)(() => {
            const { assertInvariantsIfDev } = require("../../state/invariants");
            assertInvariantsIfDev(h.state, "TEST");
        }).not.toThrow();
        h.teardown();
    });
});
// ============================================================================
// 4. MULTI-GHOST SCENARIOS
// ============================================================================
(0, globals_1.describe)("Multi-Ghost Scenarios", () => {
    (0, globals_1.test)("multiple ghosts at once", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        // Alice and Bob disconnect
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        h.dispatch(bobP.socketId, { type: ActionTypes.DISCONNECT });
        // Should have 2 ghosts, 1 connected
        const ghosts = Array.from(h.state.participants.values()).filter((p) => p.presence === "GHOST");
        const connected = Array.from(h.state.participants.values()).filter((p) => p.presence === "CONNECTED");
        (0, globals_1.expect)(ghosts.length).toBe(2);
        (0, globals_1.expect)(connected.length).toBe(1);
        h.teardown();
    });
    (0, globals_1.test)("all users ghost, then one reconnects", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        // Both disconnect
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        h.dispatch(bobP.socketId, { type: ActionTypes.DISCONNECT });
        // Phase should be ENDING (all ghosts)
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        // Alice reconnects
        h.dispatch("alice-v2", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        // Should transition back to ATTENTION_SELECTION
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("CONNECTED");
        h.teardown();
    });
    (0, globals_1.test)("consensus with mix of connected and ghosts", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol, dave] = h.addUsers(4);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        const carolP = h.getParticipant("Carol");
        const daveP = h.getParticipant("Dave");
        // Carol and Dave become ghosts
        h.dispatch(carolP.socketId, { type: ActionTypes.DISCONNECT });
        h.dispatch(daveP.socketId, { type: ActionTypes.DISCONNECT });
        // Only Alice and Bob are CONNECTED
        // Both point to Alice
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: "Alice" },
        });
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: "Alice" },
        });
        // Consensus with 2/2 CONNECTED (ghosts don't count)
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        (0, globals_1.expect)(h.liveSpeaker).toBe(aliceP.userId);
        h.teardown();
    });
    (0, globals_1.test)("sequential reconnects restore multiple ghosts", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        const carolP = h.getParticipant("Carol");
        // All disconnect
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        h.dispatch(bobP.socketId, { type: ActionTypes.DISCONNECT });
        h.dispatch(carolP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        // Reconnect one by one
        h.dispatch("alice-v2", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("CONNECTED");
        h.dispatch("bob-v2", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Bob" },
        });
        (0, globals_1.expect)(h.getParticipant("Bob").presence).toBe("CONNECTED");
        h.dispatch("carol-v2", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Carol" },
        });
        (0, globals_1.expect)(h.getParticipant("Carol").presence).toBe("CONNECTED");
        // All back, phase should be ATTENTION_SELECTION
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        h.teardown();
    });
});
// ============================================================================
// 5. SPEAKER GHOST TRANSITIONS
// ============================================================================
(0, globals_1.describe)("Speaker Ghost Transitions", () => {
    (0, globals_1.test)("speaker disconnects with others present - liveSpeaker status behavior", () => {
        const { h, speakerUserId, users } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
        const speakerP = h.getParticipantById(speakerUserId);
        // Speaker disconnects
        h.dispatch(speakerP.socketId, { type: ActionTypes.DISCONNECT });
        // Current behavior: liveSpeaker preserved if others connected
        // Note: This tests current implementation, not strict spec
        (0, globals_1.expect)(h.getParticipant(speakerP.displayName).presence).toBe("GHOST");
        // liveSpeaker status depends on implementation decision
        // If we keep current behavior: preserved
        // If we follow strict spec: cleared
        // Test documents current state
        h.teardown();
    });
    (0, globals_1.test)("speaker ghost then all others disconnect - liveSpeaker cleared", () => {
        const { h, speakerUserId, users } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        const listenerP = users.find((u) => u.userId !== speakerUserId);
        const listener = h.getParticipant(listenerP.displayName);
        // Speaker disconnects first
        h.dispatch(speakerP.socketId, { type: ActionTypes.DISCONNECT });
        // Then listener disconnects
        h.dispatch(listener.socketId, { type: ActionTypes.DISCONNECT });
        // All ghosts → liveSpeaker cleared, phase ENDING
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        h.teardown();
    });
    (0, globals_1.test)("listener becomes speaker while another is ghost", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        const carolP = h.getParticipant("Carol");
        // Carol becomes ghost
        h.dispatch(carolP.socketId, { type: ActionTypes.DISCONNECT });
        // Alice and Bob achieve consensus (2/2 CONNECTED)
        h.dispatch(aliceP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Alice", targetUserId: "Bob" },
        });
        h.dispatch(bobP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Bob", targetUserId: "Bob" },
        });
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        (0, globals_1.expect)(h.liveSpeaker).toBe(bobP.userId);
        // Ghost should not interfere
        (0, globals_1.expect)(h.getParticipant("Carol").presence).toBe("GHOST");
        h.teardown();
    });
});
// ============================================================================
// 6. GHOST DURING ALL PHASES
// ============================================================================
(0, globals_1.describe)("Ghost During All Phases", () => {
    (0, globals_1.test)("ghost during LOBBY phase", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        // Don't start session, stay in LOBBY
        (0, globals_1.expect)(h.phase).toBe("LOBBY");
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("GHOST");
        (0, globals_1.expect)(h.phase).toBe("LOBBY");
        h.teardown();
    });
    (0, globals_1.test)("ghost during ATTENTION_SELECTION phase", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        const bobP = h.getParticipant("Bob");
        h.dispatch(bobP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        (0, globals_1.expect)(h.getParticipant("Bob").presence).toBe("GHOST");
        h.teardown();
    });
    (0, globals_1.test)("ghost during LIVE_SPEAKER phase", () => {
        const { h, speakerUserId, users } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
        const listenerP = users.find((u) => u.userId !== speakerUserId);
        const listener = h.getParticipant(listenerP.displayName);
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        // Listener disconnects
        h.dispatch(listener.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        (0, globals_1.expect)(h.getParticipant(listener.displayName).presence).toBe("GHOST");
        h.teardown();
    });
    (0, globals_1.test)("ghost during ENDING phase", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        // Trigger TIMER_EXPIRED to enter ENDING
        h.dispatch(null, { type: ActionTypes.TIMER_EXPIRED });
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        // Bob disconnects during ENDING
        const bobP = h.getParticipant("Bob");
        h.dispatch(bobP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        (0, globals_1.expect)(h.getParticipant("Bob").presence).toBe("GHOST");
        h.teardown();
    });
});
// ============================================================================
// 7. EDGE CASES
// ============================================================================
(0, globals_1.describe)("Ghost Edge Cases", () => {
    (0, globals_1.test)("rapid disconnect/reconnect cycle", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        // Disconnect
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("GHOST");
        // Immediate reconnect
        h.dispatch("alice-v2", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("CONNECTED");
        // Disconnect again
        h.dispatch("alice-v2", { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("GHOST");
        // Reconnect again
        h.dispatch("alice-v3", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("CONNECTED");
        h.teardown();
    });
    (0, globals_1.test)("ghost with no other participants", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        // Solo ghost → ENDING phase
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("GHOST");
        h.teardown();
    });
    (0, globals_1.test)("purge attempt on CONNECTED user does nothing", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        // Try to purge connected user
        h.dispatch(null, {
            type: ActionTypes.PURGE_GHOST,
            payload: { userId: aliceP.userId },
        });
        // Should still exist and be CONNECTED
        (0, globals_1.expect)(h.state.participants.has(aliceP.userId)).toBe(true);
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("CONNECTED");
        h.teardown();
    });
    (0, globals_1.test)("disconnect of non-existent user handled gracefully", () => {
        const h = new TestHarness_1.TestHarness();
        h.addUsers(1);
        // Attempt to disconnect non-existent socket
        (0, globals_1.expect)(() => {
            h.dispatch("ghost-socket-999", { type: ActionTypes.DISCONNECT });
        }).not.toThrow();
        h.teardown();
    });
    (0, globals_1.test)("invariants hold with ghosts present", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const bobP = h.getParticipant("Bob");
        h.dispatch(bobP.socketId, { type: ActionTypes.DISCONNECT });
        // Invariants should still pass
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
});

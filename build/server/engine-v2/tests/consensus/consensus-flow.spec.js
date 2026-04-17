"use strict";
/**
 * Consensus Flow Tests
 *
 * Covers:
 *   - All users point to the same user → LIVE_SPEAKER
 *   - Partial consensus → no phase change
 *   - Consensus broken when one user re-points → back to ATTENTION_SELECTION
 *   - Consensus with ghost users excluded
 *   - Single user room: points to self → LIVE_SPEAKER
 *   - 3-user room: 2-of-2 connected point to same target (1 ghost excluded)
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
(0, globals_1.describe)("Consensus Flow", () => {
    // ==========================================================================
    // UNANIMOUS CONSENSUS
    // ==========================================================================
    (0, globals_1.describe)("unanimous consensus → LIVE_SPEAKER", () => {
        (0, globals_1.test)("2-user room: both point to same user → phase becomes LIVE_SPEAKER", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob] = h.addUsers(2);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            h.reachConsensusOn(aliceP.userId);
            (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h.liveSpeaker).toBe(aliceP.userId);
            h.teardown();
        });
        (0, globals_1.test)("3-user room: all three point to same user → phase becomes LIVE_SPEAKER", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob, carol] = h.addUsers(3);
            h.startSession(alice.userId);
            const carolP = h.getParticipant("Carol");
            h.reachConsensusOn(carolP.userId);
            (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h.liveSpeaker).toBe(carolP.userId);
            h.teardown();
        });
        (0, globals_1.test)("consensus emits live-speaker event", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob] = h.addUsers(2);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            h.clearEffects();
            h.reachConsensusOn(aliceP.userId);
            (0, globals_1.expect)(h.wasEmitted("live-speaker")).toBe(true);
            const data = h.lastEmit("live-speaker");
            (0, globals_1.expect)(data.userId).toBe(aliceP.userId);
            h.teardown();
        });
        (0, globals_1.test)("speaker's role becomes 'speaker', all others become 'listener'", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob, carol] = h.addUsers(3);
            h.startSession(alice.userId);
            const bobP = h.getParticipant("Bob");
            h.reachConsensusOn(bobP.userId);
            (0, globals_1.expect)(h.getParticipant("Bob").role).toBe("speaker");
            (0, globals_1.expect)(h.getParticipant("Alice").role).toBe("listener");
            (0, globals_1.expect)(h.getParticipant("Carol").role).toBe("listener");
            h.teardown();
        });
    });
    // ==========================================================================
    // PARTIAL CONSENSUS
    // ==========================================================================
    (0, globals_1.describe)("partial consensus → no phase change", () => {
        (0, globals_1.test)("2-user room: only one user points → no consensus", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob] = h.addUsers(2);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            const bobP = h.getParticipant("Bob");
            // Only Alice points to Bob
            h.dispatch(aliceP.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Alice", targetUserId: "Bob" },
            });
            (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
            h.teardown();
        });
        (0, globals_1.test)("3-user room: 2-of-3 point to same → no consensus (need all)", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob, carol] = h.addUsers(3);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            const bobP = h.getParticipant("Bob");
            // Alice and Bob point to Carol, Carol points elsewhere
            h.dispatch(aliceP.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Alice", targetUserId: "Carol" },
            });
            h.dispatch(bobP.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Bob", targetUserId: "Carol" },
            });
            (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
            h.teardown();
        });
    });
    // ==========================================================================
    // CONSENSUS BROKEN
    // ==========================================================================
    (0, globals_1.describe)("consensus broken → back to ATTENTION_SELECTION", () => {
        (0, globals_1.test)("re-point during LIVE_SPEAKER → phase drops, liveSpeaker cleared", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob, carol] = h.addUsers(3);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            h.reachConsensusOn(aliceP.userId);
            (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
            // Carol re-points to someone else
            const carolP = h.getParticipant("Carol");
            const bobP = h.getParticipant("Bob");
            h.dispatch(carolP.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Carol", targetUserId: "Bob" },
            });
            (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
            h.teardown();
        });
        (0, globals_1.test)("broken consensus emits live-speaker-cleared event", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob] = h.addUsers(2);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            h.reachConsensusOn(aliceP.userId);
            h.clearEffects();
            // Bob re-points to himself — breaks consensus
            const bobP = h.getParticipant("Bob");
            h.dispatch(bobP.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Bob", targetUserId: "Bob" },
            });
            (0, globals_1.expect)(h.wasEmitted("live-speaker-cleared")).toBe(true);
            h.teardown();
        });
    });
    // ==========================================================================
    // GHOST EXCLUSION
    // ==========================================================================
    (0, globals_1.describe)("ghost users excluded from consensus quorum", () => {
        (0, globals_1.test)("3-user room: 1 ghost + 2 connected all pointing same → consensus", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob, carol] = h.addUsers(3);
            h.startSession(alice.userId);
            // Carol disconnects (becomes ghost)
            const carolP = h.getParticipant("Carol");
            h.dispatch(carolP.socketId, { type: ActionTypes.DISCONNECT });
            (0, globals_1.expect)(h.getParticipant("Carol").presence).toBe("GHOST");
            // Alice and Bob (the 2 connected) both point to Alice
            const aliceP = h.getParticipant("Alice");
            const bobP = h.getParticipant("Bob");
            h.dispatch(aliceP.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Alice", targetUserId: "Alice" },
            });
            h.dispatch(bobP.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Bob", targetUserId: "Alice" },
            });
            // 2/2 connected users agree → consensus
            (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h.liveSpeaker).toBe(aliceP.userId);
            h.teardown();
        });
    });
    // ==========================================================================
    // POINTER MAP INTEGRITY
    // ==========================================================================
    (0, globals_1.describe)("pointer map integrity", () => {
        (0, globals_1.test)("POINT_TO_USER updates pointerMap[fromId] → toId", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob] = h.addUsers(2);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            const bobP = h.getParticipant("Bob");
            h.dispatch(aliceP.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Alice", targetUserId: "Bob" },
            });
            (0, globals_1.expect)(h.state.pointerMap.get(aliceP.userId)).toBe(bobP.userId);
            h.teardown();
        });
        (0, globals_1.test)("re-pointing updates the existing pointer (no duplicates)", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob, carol] = h.addUsers(3);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            h.dispatch(aliceP.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Alice", targetUserId: "Bob" },
            });
            h.dispatch(aliceP.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Alice", targetUserId: "Carol" },
            });
            const carolP = h.getParticipant("Carol");
            (0, globals_1.expect)(h.state.pointerMap.get(aliceP.userId)).toBe(carolP.userId);
            // Still only 1 pointer from Alice, not 2
            (0, globals_1.expect)(h.state.pointerMap.size).toBe(1);
            h.teardown();
        });
    });
});

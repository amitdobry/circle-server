"use strict";
/**
 * Invariant Check Tests
 *
 * Tests that ALL state invariants defined in invariants.ts are enforced.
 * Each test verifies a specific invariant holds after valid mutations,
 * and (where possible) that manually breaking state triggers a violation.
 *
 * Invariants:
 *   1. liveSpeaker exists in participants
 *   2. pointerMap keys/values exist in participants
 *   3. LIVE_SPEAKER phase requires liveSpeaker
 *   4. SYNC_PAUSE phase requires syncPause = true
 *   5. Avatar uniqueness per room
 *   6. Speaker presence must be CONNECTED or GHOST
 *
 * Strategy:
 *   - "Valid path" tests: run normal flows, assert no invariant error
 *   - "Violation" tests: manually corrupt state, assert InvariantViolation thrown
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
const types_1 = require("../../state/types");
const invariants_1 = require("../../state/invariants");
const ActionTypes = __importStar(require("../../actions/actionTypes"));
// ============================================================================
// VALID STATES: invariants never fire
// ============================================================================
(0, globals_1.describe)("Invariants — valid states", () => {
    (0, globals_1.test)("initial empty room passes invariants", () => {
        const h = new TestHarness_1.TestHarness();
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
    (0, globals_1.test)("room with joined users passes invariants", () => {
        const h = new TestHarness_1.TestHarness();
        h.addUsers(3);
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
    (0, globals_1.test)("active session with live speaker passes invariants", () => {
        const { h } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
    (0, globals_1.test)("after drop mic passes invariants", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        h.dropMic(speakerP.socketId);
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
    (0, globals_1.test)("after disconnect passes invariants", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
    (0, globals_1.test)("after reconnect passes invariants", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        h.dispatch("alice-new", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
    (0, globals_1.test)("after timer expiry passes invariants", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        h.expireTimer();
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
});
// ============================================================================
// VIOLATION TESTS: manually corrupt state to confirm guards fire
// ============================================================================
(0, globals_1.describe)("Invariants — violations detected", () => {
    (0, globals_1.test)("liveSpeaker pointing to non-existent user → InvariantViolation", () => {
        const h = new TestHarness_1.TestHarness();
        h.addUsers(2);
        h.startSession(h.getParticipant("Alice").socketId);
        // Manually corrupt state: set liveSpeaker to a userId that doesn't exist
        h.state.liveSpeaker = "ghost-user-who-was-never-added";
        (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).toThrow(types_1.InvariantViolation);
        h.teardown();
    });
    (0, globals_1.test)("pointerMap key not in participants → InvariantViolation", () => {
        const h = new TestHarness_1.TestHarness();
        h.addUsers(2);
        h.startSession(h.getParticipant("Alice").socketId);
        const aliceP = h.getParticipant("Alice");
        // Add a stale pointer from a userId that doesn't exist
        h.state.pointerMap.set("stale-user-id", aliceP.userId);
        (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).toThrow(types_1.InvariantViolation);
        h.teardown();
    });
    (0, globals_1.test)("pointerMap value not in participants → InvariantViolation", () => {
        const h = new TestHarness_1.TestHarness();
        h.addUsers(2);
        h.startSession(h.getParticipant("Alice").socketId);
        const aliceP = h.getParticipant("Alice");
        // Alice points to a userId that doesn't exist
        h.state.pointerMap.set(aliceP.userId, "deleted-target-id");
        (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).toThrow(types_1.InvariantViolation);
        h.teardown();
    });
    (0, globals_1.test)("phase=LIVE_SPEAKER but liveSpeaker=null → InvariantViolation", () => {
        const h = new TestHarness_1.TestHarness();
        h.addUsers(2);
        h.startSession(h.getParticipant("Alice").socketId);
        // Manually corrupt: set LIVE_SPEAKER phase but clear liveSpeaker
        h.state.phase = "LIVE_SPEAKER";
        h.state.liveSpeaker = null;
        (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).toThrow(types_1.InvariantViolation);
        h.teardown();
    });
    (0, globals_1.test)("phase=SYNC_PAUSE but syncPause=false → InvariantViolation", () => {
        const h = new TestHarness_1.TestHarness();
        h.addUsers(2);
        h.startSession(h.getParticipant("Alice").socketId);
        // Manually corrupt
        h.state.phase = "SYNC_PAUSE";
        h.state.syncPause = false;
        (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).toThrow(types_1.InvariantViolation);
        h.teardown();
    });
});
// ============================================================================
// REGRESSION: known bugs that invariants should catch
// ============================================================================
(0, globals_1.describe)("Invariants — regression guards", () => {
    (0, globals_1.test)("[regression] stale pointer after user leaves does not survive", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const carolP = h.getParticipant("Carol");
        // Carol points at Alice
        h.dispatch(carolP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Carol", targetUserId: "Alice" },
        });
        // Carol leaves — her pointer should be cleaned up
        h.leave({ userId: carolP.socketId, displayName: "Carol", avatarId: carolP.avatarId });
        // pointerMap must not contain Carol's userId anymore
        (0, globals_1.expect)(h.state.pointerMap.has(carolP.userId)).toBe(false);
        // Invariants should still hold
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
    (0, globals_1.test)("[regression] liveSpeaker is cleared when speaker leaves", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        h.leave({ userId: speakerP.socketId, displayName: speakerP.displayName, avatarId: speakerP.avatarId });
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
    (0, globals_1.test)("[regression] drop mic always clears liveSpeaker (not just participant role)", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        h.dropMic(speakerP.socketId);
        // liveSpeaker must be null — not just role reset
        (0, globals_1.expect)(h.state.liveSpeaker).toBeNull();
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
});

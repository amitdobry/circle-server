"use strict";
/**
 * Disconnect / Reconnect Tests
 *
 * Covers:
 *   DISCONNECT:
 *     - User → GHOST, seat preserved
 *     - socketId set to null
 *     - Speaker disconnects: all others still connected → seat held
 *     - Speaker disconnects: all users gone → liveSpeaker cleared
 *     - Emits v2:user-ghosted
 *
 *   RECONNECT:
 *     - GHOST → CONNECTED with new socketId
 *     - Live speaker reconnects → mic still held
 *     - Non-existent user cannot reconnect
 *     - Emits v2:reconnect-state
 *
 *   MID-SESSION JOIN (join while in ATTENTION_SELECTION / LIVE_SPEAKER):
 *     - New user joins mid-session → added, phase unchanged
 *     - Does NOT break existing consensus
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
// DISCONNECT
// ============================================================================
(0, globals_1.describe)("DISCONNECT", () => {
    (0, globals_1.test)("disconnected user becomes GHOST, seat preserved", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        const updated = h.getParticipant("Alice");
        (0, globals_1.expect)(updated.presence).toBe("GHOST");
        // Participant is still in the map
        (0, globals_1.expect)(h.state.participants.has(aliceP.userId)).toBe(true);
        h.teardown();
    });
    (0, globals_1.test)("disconnected user's socketId becomes null", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.getParticipant("Alice").socketId).toBeNull();
        h.teardown();
    });
    (0, globals_1.test)("speaker disconnects — others still connected — mic held (liveSpeaker preserved)", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
        const speakerP = h.getParticipantById(speakerUserId);
        h.dispatch(speakerP.socketId, { type: ActionTypes.DISCONNECT });
        // Speaker is gone but liveSpeaker is preserved while others are connected
        (0, globals_1.expect)(h.liveSpeaker).toBe(speakerUserId);
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        h.teardown();
    });
    (0, globals_1.test)("speaker disconnects — all users gone — liveSpeaker cleared", () => {
        const { h, speakerUserId, users } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        // Disconnect both users
        for (const user of users) {
            const p = h.getParticipant(user.displayName);
            if (p?.presence === "CONNECTED") {
                h.dispatch(p.socketId, { type: ActionTypes.DISCONNECT });
            }
        }
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        h.teardown();
    });
    (0, globals_1.test)("disconnect emits v2:user-ghosted event", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.clearEffects();
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.wasEmitted("v2:user-ghosted")).toBe(true);
        h.teardown();
    });
    (0, globals_1.test)("invariants hold after disconnect", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
        const speakerP = h.getParticipantById(speakerUserId);
        h.dispatch(speakerP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
});
// ============================================================================
// RECONNECT
// ============================================================================
(0, globals_1.describe)("RECONNECT", () => {
    (0, globals_1.test)("ghost user reconnects → presence becomes CONNECTED", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        // Go ghost
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("GHOST");
        // Reconnect
        const newSocket = "alice-socket-v2";
        h.dispatch(newSocket, {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("CONNECTED");
        h.teardown();
    });
    (0, globals_1.test)("reconnected user gets new socketId", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        const newSocket = "alice-new-socket";
        h.dispatch(newSocket, {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        (0, globals_1.expect)(h.getParticipant("Alice").socketId).toBe(newSocket);
        h.teardown();
    });
    (0, globals_1.test)("live speaker reconnects — mic still held", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        const speakerName = speakerP.displayName;
        // Speaker disconnects
        h.dispatch(speakerP.socketId, { type: ActionTypes.DISCONNECT });
        // Mic still held (others connected)
        (0, globals_1.expect)(h.liveSpeaker).toBe(speakerUserId);
        // Speaker reconnects
        const newSocket = "speaker-socket-v2";
        h.dispatch(newSocket, {
            type: ActionTypes.RECONNECT,
            payload: { displayName: speakerName },
        });
        // Should still be live speaker
        (0, globals_1.expect)(h.liveSpeaker).toBe(speakerUserId);
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        h.teardown();
    });
    (0, globals_1.test)("reconnect emits v2:reconnect-state event", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        h.clearEffects();
        h.dispatch("alice-new-socket", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        (0, globals_1.expect)(h.wasEmitted("v2:reconnect-state")).toBe(true);
        h.teardown();
    });
    (0, globals_1.test)("reconnecting unknown user produces no changes", () => {
        const h = new TestHarness_1.TestHarness();
        h.addUsers(2);
        h.startSession(h.getParticipant("Alice").socketId);
        const beforeSize = h.state.participants.size;
        h.dispatch("ghost-socket-999", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "NoBodyHere" },
        });
        (0, globals_1.expect)(h.state.participants.size).toBe(beforeSize);
        h.teardown();
    });
    (0, globals_1.test)("invariants hold after reconnect", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
        h.dispatch("alice-v2", {
            type: ActionTypes.RECONNECT,
            payload: { displayName: "Alice" },
        });
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
});
// ============================================================================
// MID-SESSION JOIN
// ============================================================================
(0, globals_1.describe)("Mid-session join", () => {
    (0, globals_1.test)("user joins during ATTENTION_SELECTION — added without disrupting phase", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        const carol = h.addUser("Carol");
        (0, globals_1.expect)(h.state.participants.size).toBe(3);
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        h.teardown();
    });
    (0, globals_1.test)("user joins during LIVE_SPEAKER — phase unchanged, liveSpeaker unchanged", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        const carol = h.addUser("Carol");
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        (0, globals_1.expect)(h.liveSpeaker).toBe(speakerUserId);
        h.teardown();
    });
    (0, globals_1.test)("late joiner does not get included in existing pointerMap consensus check", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        // Alice and Bob both point to Alice (consensus achieved)
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
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        // Carol joins after consensus — doesn't break it
        h.addUser("Carol");
        // Phase should remain LIVE_SPEAKER (Carol hasn't disrupted pointers)
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        (0, globals_1.expect)(h.liveSpeaker).toBe(aliceP.userId);
        h.assertInvariants();
        h.teardown();
    });
});

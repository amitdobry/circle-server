"use strict";
/**
 * Mic Flow Tests
 *
 * Covers:
 *   DROP_MIC:
 *     - Phase: LIVE_SPEAKER → ATTENTION_SELECTION
 *     - liveSpeaker cleared
 *     - pointerMap cleared
 *     - All roles reset to listener
 *     - Emits live-speaker-cleared
 *
 *   PASS_MIC:
 *     - Same mutations as DROP_MIC
 *     - Emits live-speaker-cleared
 *
 *   ACCEPT_MIC:
 *     - User becomes live speaker directly
 *     - Phase → LIVE_SPEAKER
 *     - Emits live-speaker
 *
 *   DECLINE_MIC:
 *     - Pointer cleared for decliner
 *     - Phase stays in ATTENTION_SELECTION
 *     - Emits REBUILD_ALL_PANELS
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
// DROP_MIC
// ============================================================================
(0, globals_1.describe)("DROP_MIC", () => {
    (0, globals_1.test)("phase transitions LIVE_SPEAKER → ATTENTION_SELECTION", () => {
        const { h, users, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        const speakerP = h.getParticipantById(speakerUserId);
        h.dropMic(speakerP.socketId);
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        h.teardown();
    });
    (0, globals_1.test)("liveSpeaker is null after drop", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        h.dropMic(speakerP.socketId);
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        h.teardown();
    });
    (0, globals_1.test)("pointerMap is cleared after drop", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
        const speakerP = h.getParticipantById(speakerUserId);
        // Confirm pointerMap was populated during consensus
        (0, globals_1.expect)(h.state.pointerMap.size).toBeGreaterThan(0);
        h.dropMic(speakerP.socketId);
        (0, globals_1.expect)(h.state.pointerMap.size).toBe(0);
        h.teardown();
    });
    (0, globals_1.test)("all participant roles reset to 'listener' after drop", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
        const speakerP = h.getParticipantById(speakerUserId);
        (0, globals_1.expect)(speakerP.role).toBe("speaker");
        h.dropMic(speakerP.socketId);
        for (const p of h.state.participants.values()) {
            (0, globals_1.expect)(p.role).toBe("listener");
        }
        h.teardown();
    });
    (0, globals_1.test)("emits live-speaker-cleared event", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        h.clearEffects();
        h.dropMic(speakerP.socketId);
        (0, globals_1.expect)(h.wasEmitted("live-speaker-cleared")).toBe(true);
        h.teardown();
    });
    (0, globals_1.test)("invariants hold after drop", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        h.dropMic(speakerP.socketId);
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
});
// ============================================================================
// PASS_MIC
// ============================================================================
(0, globals_1.describe)("PASS_MIC", () => {
    (0, globals_1.test)("phase transitions LIVE_SPEAKER → ATTENTION_SELECTION", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        h.passMic(speakerP.socketId);
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        h.teardown();
    });
    (0, globals_1.test)("pointerMap cleared after pass", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
        const speakerP = h.getParticipantById(speakerUserId);
        h.passMic(speakerP.socketId);
        (0, globals_1.expect)(h.state.pointerMap.size).toBe(0);
        h.teardown();
    });
    (0, globals_1.test)("all roles reset to 'listener' after pass", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
        const speakerP = h.getParticipantById(speakerUserId);
        h.passMic(speakerP.socketId);
        for (const p of h.state.participants.values()) {
            (0, globals_1.expect)(p.role).toBe("listener");
        }
        h.teardown();
    });
    (0, globals_1.test)("emits live-speaker-cleared", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        h.clearEffects();
        h.passMic(speakerP.socketId);
        (0, globals_1.expect)(h.wasEmitted("live-speaker-cleared")).toBe(true);
        h.teardown();
    });
    (0, globals_1.test)("invariants hold after pass", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        h.passMic(speakerP.socketId);
        (0, globals_1.expect)(() => h.assertInvariants()).not.toThrow();
        h.teardown();
    });
});
// ============================================================================
// ACCEPT_MIC
// ============================================================================
(0, globals_1.describe)("ACCEPT_MIC", () => {
    (0, globals_1.test)("user accepts mic → becomes live speaker, phase → LIVE_SPEAKER", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        // Simulate being offered the mic by dispatching ACCEPT_MIC directly
        const bobP = h.getParticipant("Bob");
        h.dispatch(bobP.socketId, { type: ActionTypes.ACCEPT_MIC });
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        (0, globals_1.expect)(h.liveSpeaker).toBe(bobP.userId);
        h.teardown();
    });
    (0, globals_1.test)("accepter's role becomes 'speaker'", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const bobP = h.getParticipant("Bob");
        h.dispatch(bobP.socketId, { type: ActionTypes.ACCEPT_MIC });
        (0, globals_1.expect)(h.getParticipant("Bob").role).toBe("speaker");
        (0, globals_1.expect)(h.getParticipant("Alice").role).toBe("listener");
        h.teardown();
    });
    (0, globals_1.test)("ACCEPT_MIC emits live-speaker event", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const bobP = h.getParticipant("Bob");
        h.clearEffects();
        h.dispatch(bobP.socketId, { type: ActionTypes.ACCEPT_MIC });
        (0, globals_1.expect)(h.wasEmitted("live-speaker")).toBe(true);
        const data = h.lastEmit("live-speaker");
        (0, globals_1.expect)(data.userId).toBe(bobP.userId);
        h.teardown();
    });
    (0, globals_1.test)("unknown user cannot accept mic", () => {
        const h = new TestHarness_1.TestHarness();
        h.addUsers(2);
        h.startSession(h.getParticipant("Alice").socketId);
        const effects = h.dispatch("unknown-socket-xyz", { type: ActionTypes.ACCEPT_MIC });
        // Should produce no useful effects (user not found)
        (0, globals_1.expect)(effects.length).toBe(0);
        h.teardown();
    });
});
// ============================================================================
// DECLINE_MIC
// ============================================================================
(0, globals_1.describe)("DECLINE_MIC", () => {
    (0, globals_1.test)("decliner's pointer removed from pointerMap", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob, carol] = h.addUsers(3);
        h.startSession(alice.userId);
        const carolP = h.getParticipant("Carol");
        // Add a pointer for Carol first
        h.dispatch(carolP.socketId, {
            type: ActionTypes.POINT_TO_USER,
            payload: { from: "Carol", targetUserId: "Alice" },
        });
        (0, globals_1.expect)(h.state.pointerMap.has(carolP.userId)).toBe(true);
        h.dispatch(carolP.socketId, { type: ActionTypes.DECLINE_MIC });
        (0, globals_1.expect)(h.state.pointerMap.has(carolP.userId)).toBe(false);
        h.teardown();
    });
    (0, globals_1.test)("phase stays ATTENTION_SELECTION after decline", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const bobP = h.getParticipant("Bob");
        h.dispatch(bobP.socketId, { type: ActionTypes.DECLINE_MIC });
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        h.teardown();
    });
    (0, globals_1.test)("decline emits REBUILD_ALL_PANELS effect", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const bobP = h.getParticipant("Bob");
        h.clearEffects();
        h.dispatch(bobP.socketId, { type: ActionTypes.DECLINE_MIC });
        const rebuild = h.effects.find((e) => e.type === "REBUILD_ALL_PANELS");
        (0, globals_1.expect)(rebuild).toBeDefined();
        h.teardown();
    });
});
// ============================================================================
// FULL MIC CYCLE: consensus → live speaker → drop → consensus again
// ============================================================================
(0, globals_1.describe)("Full mic cycle", () => {
    (0, globals_1.test)("consensus → drop → new consensus works cleanly", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice, bob] = h.addUsers(2);
        h.startSession(alice.userId);
        const aliceP = h.getParticipant("Alice");
        const bobP = h.getParticipant("Bob");
        // Round 1: Alice speaks
        h.reachConsensusOn(aliceP.userId);
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        (0, globals_1.expect)(h.liveSpeaker).toBe(aliceP.userId);
        // Alice drops
        h.dropMic(aliceP.socketId);
        (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        // Round 2: Bob speaks
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
        h.assertInvariants();
        h.teardown();
    });
});

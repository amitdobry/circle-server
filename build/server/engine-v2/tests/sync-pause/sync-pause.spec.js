"use strict";
/**
 * Sync Pause Behavior Tests
 *
 * Validates that `syncPause` is not a cosmetic flag — it must stay
 * consistent with `phase`, `liveSpeaker`, and pointer state across
 * every transition.
 *
 * Contract (from reducer):
 *   syncPause = false  →  normal active flow (or plain attention selection)
 *   syncPause = true   →  room is between speakers via an explicit handoff
 *                         (DROP_MIC or PASS_MIC initiated the pause)
 *
 * Broken consensus from a re-point does NOT set syncPause = true.
 * That is intentional: it returns to plain attention-selection mode.
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
const invariants_1 = require("../../state/invariants");
const ActionTypes = __importStar(require("../../actions/actionTypes"));
// ============================================================================
// ASSERTION HELPERS
// ============================================================================
function expectActiveSpeakerRoom(state, h) {
    (0, globals_1.expect)(h.state.liveSpeaker).not.toBeNull();
    (0, globals_1.expect)(h.state.phase).toBe("LIVE_SPEAKER");
    (0, globals_1.expect)(h.state.syncPause).toBe(false);
}
function expectPausedRoom(h) {
    (0, globals_1.expect)(h.state.liveSpeaker).toBeNull();
    (0, globals_1.expect)(h.state.syncPause).toBe(true);
    (0, globals_1.expect)(h.state.phase).not.toBe("LIVE_SPEAKER");
}
function expectNoLiveSpeaker(h) {
    (0, globals_1.expect)(h.state.liveSpeaker).toBeNull();
}
// ============================================================================
// GROUP 1 — BASELINE
// ============================================================================
(0, globals_1.describe)("sync pause behavior", () => {
    (0, globals_1.describe)("baseline", () => {
        (0, globals_1.test)("1. session start does not enter sync pause", () => {
            const { h, users } = (0, TestHarness_1.createSessionWithUsers)(2);
            (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
            (0, globals_1.expect)(h.state.syncPause).toBe(false);
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
            h.teardown();
        });
        (0, globals_1.test)("2. consensus into live speaker clears sync pause", () => {
            const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h.state.syncPause).toBe(false);
            (0, globals_1.expect)(h.liveSpeaker).toBe(speakerUserId);
            h.teardown();
        });
        (0, globals_1.test)("2b. syncPause is false before any action in LOBBY", () => {
            const h = new TestHarness_1.TestHarness();
            h.addUsers(2);
            (0, globals_1.expect)(h.state.syncPause).toBe(false);
            h.teardown();
        });
    });
    // ==========================================================================
    // GROUP 2 — MIC HANDOFF
    // ==========================================================================
    (0, globals_1.describe)("mic handoff", () => {
        (0, globals_1.test)("3. DROP_MIC enters paused coordination state", () => {
            const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            const speakerP = h.getParticipantById(speakerUserId);
            h.dropMic(speakerP.socketId);
            expectPausedRoom(h);
            (0, globals_1.expect)(h.state.phase).toBe("ATTENTION_SELECTION");
            (0, globals_1.expect)(h.state.pointerMap.size).toBe(0);
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
            h.teardown();
        });
        (0, globals_1.test)("4. PASS_MIC enters paused coordination state", () => {
            const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            const speakerP = h.getParticipantById(speakerUserId);
            h.passMic(speakerP.socketId);
            expectPausedRoom(h);
            (0, globals_1.expect)(h.state.phase).toBe("ATTENTION_SELECTION");
            (0, globals_1.expect)(h.state.pointerMap.size).toBe(0);
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
            h.teardown();
        });
        (0, globals_1.test)("5. ACCEPT_MIC exits paused coordination state", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob] = h.addUsers(2);
            h.startSession(alice.userId);
            // Simulate post-pass-mic: syncPause=true, no speaker
            const aliceP = h.getParticipant("Alice");
            const bobP = h.getParticipant("Bob");
            // Drive to live speaker first, then pass mic to create paused state
            h.reachConsensusOn(aliceP.userId);
            (0, globals_1.expect)(h.state.syncPause).toBe(false);
            h.passMic(aliceP.socketId);
            (0, globals_1.expect)(h.state.syncPause).toBe(true);
            // Bob accepts
            h.dispatch(bobP.socketId, { type: ActionTypes.ACCEPT_MIC });
            (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h.state.syncPause).toBe(false);
            (0, globals_1.expect)(h.liveSpeaker).toBe(bobP.userId);
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
            h.teardown();
        });
        (0, globals_1.test)("6. DECLINE_MIC does not resume active speaking — syncPause stays consistent", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob] = h.addUsers(2);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            const bobP = h.getParticipant("Bob");
            h.reachConsensusOn(aliceP.userId);
            h.dropMic(aliceP.socketId);
            // Paused state established
            (0, globals_1.expect)(h.state.syncPause).toBe(true);
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
            // Bob declines mic
            h.dispatch(bobP.socketId, { type: ActionTypes.DECLINE_MIC });
            // Room must NOT jump to LIVE_SPEAKER
            (0, globals_1.expect)(h.phase).not.toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
            h.teardown();
        });
    });
    // ==========================================================================
    // GROUP 3 — CONSENSUS RESET
    // ==========================================================================
    (0, globals_1.describe)("consensus reset", () => {
        (0, globals_1.test)("7. breaking consensus via re-point → ATTENTION_SELECTION, syncPause=false (not a handoff)", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob, carol] = h.addUsers(3);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            const carolP = h.getParticipant("Carol");
            const bobP = h.getParticipant("Bob");
            h.reachConsensusOn(aliceP.userId);
            (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
            // Carol re-points to Bob — breaks consensus
            h.dispatch(carolP.socketId, {
                type: ActionTypes.POINT_TO_USER,
                payload: { from: "Carol", targetUserId: "Bob" },
            });
            // Contract: broken consensus = plain attention selection, no handoff pause
            (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
            (0, globals_1.expect)(h.state.syncPause).toBe(false); // NOT a mic handoff — no pause
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
            h.teardown();
        });
    });
    // ==========================================================================
    // GROUP 4 — DISCONNECT EDGE CASES
    // ==========================================================================
    (0, globals_1.describe)("disconnect", () => {
        (0, globals_1.test)("8. speaker disconnect — mic drops immediately (speaker invalidation)", () => {
            const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
            const speakerP = h.getParticipantById(speakerUserId);
            h.dispatch(speakerP.socketId, { type: ActionTypes.DISCONNECT });
            // ✅ NEW BEHAVIOR: Mic drops immediately when speaker disconnects
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
            (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
            (0, globals_1.expect)(h.state.syncPause).toBe(false);
            // No contradiction: ATTENTION_SELECTION + syncPause=false is valid
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
            h.teardown();
        });
        (0, globals_1.test)("9. last user disconnects — phase ENDING, syncPause=false (not a coordination state)", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice] = h.addUsers(1);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            h.dispatch(aliceP.socketId, { type: ActionTypes.DISCONNECT });
            (0, globals_1.expect)(h.phase).toBe("ENDING");
            (0, globals_1.expect)(h.state.syncPause).toBe(false);
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
            h.teardown();
        });
        (0, globals_1.test)("9b. last user disconnects after live speaker was set — liveSpeaker cleared in ENDING", () => {
            const { h, speakerUserId, users } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            // Disconnect both users
            for (const user of users) {
                const p = h.getParticipant(user.displayName);
                if (p?.presence === "CONNECTED") {
                    h.dispatch(p.socketId, { type: ActionTypes.DISCONNECT });
                }
            }
            (0, globals_1.expect)(h.phase).toBe("ENDING");
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
            (0, globals_1.expect)(h.state.syncPause).toBe(false);
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
            h.teardown();
        });
    });
    // ==========================================================================
    // GROUP 5 — REGRESSION GUARDS
    // ==========================================================================
    (0, globals_1.describe)("regressions", () => {
        (0, globals_1.test)("10. [regression] drop mic always clears liveSpeaker AND sets syncPause", () => {
            const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            const speakerP = h.getParticipantById(speakerUserId);
            h.dropMic(speakerP.socketId);
            // Both must be set — not just a role reset
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
            (0, globals_1.expect)(h.state.syncPause).toBe(true);
            h.teardown();
        });
        (0, globals_1.test)("11. [regression] pass mic always clears liveSpeaker AND sets syncPause", () => {
            const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
            const speakerP = h.getParticipantById(speakerUserId);
            h.passMic(speakerP.socketId);
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
            (0, globals_1.expect)(h.state.syncPause).toBe(true);
            h.teardown();
        });
        (0, globals_1.test)("12. [regression] accept mic always clears syncPause", () => {
            const h = new TestHarness_1.TestHarness();
            const [alice, bob] = h.addUsers(2);
            h.startSession(alice.userId);
            const aliceP = h.getParticipant("Alice");
            const bobP = h.getParticipant("Bob");
            h.reachConsensusOn(aliceP.userId);
            h.dropMic(aliceP.socketId);
            // Verify paused state before accept
            (0, globals_1.expect)(h.state.syncPause).toBe(true);
            h.dispatch(bobP.socketId, { type: ActionTypes.ACCEPT_MIC });
            // Must be false — paused flag must not survive into active speaker state
            (0, globals_1.expect)(h.state.syncPause).toBe(false);
            (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
            h.teardown();
        });
        (0, globals_1.test)("13. [regression] LIVE_SPEAKER phase and syncPause=true never co-exist", () => {
            // After any sequence that ends in LIVE_SPEAKER, syncPause must be false
            const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(3);
            (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h.state.syncPause).toBe(false);
            (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
            h.teardown();
        });
    });
});

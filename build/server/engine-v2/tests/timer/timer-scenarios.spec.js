"use strict";
/**
 * Timer Scenario Tests
 *
 * Covers the session timer lifecycle and all expiry paths:
 *
 *   - Timer activated on session start
 *   - Timer state fields (active, durationMs, endTime)
 *   - TIMER_EXPIRED → ENDING phase
 *   - TIMER_EXPIRED → DELAYED_ACTION (END_SESSION in 30s)
 *   - TIMER_EXPIRED → timer.active = false
 *   - END_SESSION → ENDED phase
 *   - END_SESSION clears liveSpeaker
 *   - END_SESSION emits SCHEDULE_CLEANUP effect
 *   - ADMIN_END_SESSION → ENDED immediately (no grace period)
 *   - ADMIN_END_SESSION clears live speaker
 *   - ADMIN_END_SESSION emits reason: "admin-terminated"
 *   - Timer selector helpers: isTimerExpired, getRemainingTime, isInGracePeriod
 *   - Double-expiry ignored (idempotent)
 *   - Expiry during LIVE_SPEAKER → speaker state handled
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
const selectors_1 = require("../../state/selectors");
const ActionTypes = __importStar(require("../../actions/actionTypes"));
// ============================================================================
// TIMER ACTIVATION
// ============================================================================
(0, globals_1.describe)("Timer activation", () => {
    (0, globals_1.test)("timer is inactive before session start", () => {
        const h = new TestHarness_1.TestHarness();
        h.addUsers(2);
        (0, globals_1.expect)(h.state.timer.active).toBe(false);
        h.teardown();
    });
    (0, globals_1.test)("timer becomes active on session start", () => {
        const { h, users } = (0, TestHarness_1.createSessionWithUsers)(2);
        (0, globals_1.expect)(h.state.timer.active).toBe(true);
        h.teardown();
    });
    (0, globals_1.test)("timer.durationMs matches durationMinutes passed to start", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        h.startSession(alice.userId, 45);
        (0, globals_1.expect)(h.state.timer.durationMs).toBe(45 * 60 * 1000);
        h.teardown();
    });
    (0, globals_1.test)("timer.endTime is set to startTime + durationMs", () => {
        const h = new TestHarness_1.TestHarness();
        const [alice] = h.addUsers(1);
        const before = Date.now();
        h.startSession(alice.userId, 60);
        const after = Date.now();
        const { startTime, durationMs, endTime } = h.state.timer;
        (0, globals_1.expect)(endTime).toBeDefined();
        (0, globals_1.expect)(endTime).toBeGreaterThanOrEqual(before + durationMs);
        (0, globals_1.expect)(endTime).toBeLessThanOrEqual(after + durationMs + 50);
        h.teardown();
    });
    (0, globals_1.test)("getRemainingTime returns positive value for a fresh timer", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        const remaining = (0, selectors_1.getRemainingTime)(h.state);
        (0, globals_1.expect)(remaining).toBeGreaterThan(0);
        h.teardown();
    });
    (0, globals_1.test)("isTimerExpired returns false for a fresh timer", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        (0, globals_1.expect)((0, selectors_1.isTimerExpired)(h.state)).toBe(false);
        h.teardown();
    });
    (0, globals_1.test)("isInGracePeriod returns false before expiry", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        (0, globals_1.expect)((0, selectors_1.isInGracePeriod)(h.state)).toBe(false);
        h.teardown();
    });
});
// ============================================================================
// TIMER_EXPIRED → ENDING
// ============================================================================
(0, globals_1.describe)("TIMER_EXPIRED", () => {
    (0, globals_1.test)("phase transitions to ENDING", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.expireTimer();
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        h.teardown();
    });
    (0, globals_1.test)("timer.active is false after expiry", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.expireTimer();
        (0, globals_1.expect)(h.state.timer.active).toBe(false);
        h.teardown();
    });
    (0, globals_1.test)("emits v2:session-ending event", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.clearEffects();
        h.expireTimer();
        (0, globals_1.expect)(h.wasEmitted("v2:session-ending")).toBe(true);
        h.teardown();
    });
    (0, globals_1.test)("v2:session-ending includes gracePeriodMs = 30000", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.clearEffects();
        h.expireTimer();
        const data = h.lastEmit("v2:session-ending");
        (0, globals_1.expect)(data.gracePeriodMs).toBe(30000);
        h.teardown();
    });
    (0, globals_1.test)("emits TIMER_CANCEL effect", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.clearEffects();
        h.expireTimer();
        const cancel = h.effects.find((e) => e.type === "TIMER_CANCEL");
        (0, globals_1.expect)(cancel).toBeDefined();
        h.teardown();
    });
    (0, globals_1.test)("schedules DELAYED_ACTION for END_SESSION after 30s", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.clearEffects();
        h.expireTimer();
        const delayed = h.effects.find((e) => e.type === "DELAYED_ACTION");
        (0, globals_1.expect)(delayed).toBeDefined();
        (0, globals_1.expect)(delayed.action.type).toBe("END_SESSION");
        (0, globals_1.expect)(delayed.delayMs).toBe(30000);
        h.teardown();
    });
    (0, globals_1.test)("isInGracePeriod returns true after expiry", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.expireTimer();
        (0, globals_1.expect)((0, selectors_1.isInGracePeriod)(h.state)).toBe(true);
        h.teardown();
    });
    (0, globals_1.test)("expiry while live speaker is active — phase still becomes ENDING", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        (0, globals_1.expect)(h.phase).toBe("LIVE_SPEAKER");
        h.expireTimer();
        (0, globals_1.expect)(h.phase).toBe("ENDING");
        h.teardown();
    });
    (0, globals_1.test)("invariants hold after expiry", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.expireTimer();
        (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
        h.teardown();
    });
    (0, globals_1.test)("double expiry is handled gracefully (idempotent phase)", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.expireTimer();
        // ENDING phase — timer already inactive
        h.expireTimer(); // second call while in ENDING
        // Should not crash or corrupt state — phase may become ENDING again or stay
        (0, globals_1.expect)(h.phase).not.toBe("LOBBY");
        (0, globals_1.expect)(h.phase).not.toBe("ATTENTION_SELECTION");
        (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
        h.teardown();
    });
});
// ============================================================================
// END_SESSION (Grace Period Expired)
// ============================================================================
(0, globals_1.describe)("END_SESSION", () => {
    (0, globals_1.test)("phase transitions to ENDED", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.expireTimer();
        h.endSession();
        (0, globals_1.expect)(h.phase).toBe("ENDED");
        h.teardown();
    });
    (0, globals_1.test)("liveSpeaker cleared on END_SESSION", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        h.expireTimer();
        h.endSession();
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        h.teardown();
    });
    (0, globals_1.test)("speaker role reset to listener on END_SESSION", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        const speakerP = h.getParticipantById(speakerUserId);
        (0, globals_1.expect)(speakerP.role).toBe("speaker");
        h.expireTimer();
        h.endSession();
        (0, globals_1.expect)(h.getParticipantById(speakerUserId).role).toBe("listener");
        h.teardown();
    });
    (0, globals_1.test)("timer.active is false after END_SESSION", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.expireTimer();
        h.endSession();
        (0, globals_1.expect)(h.state.timer.active).toBe(false);
        h.teardown();
    });
    (0, globals_1.test)("emits v2:session-ended event", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.expireTimer();
        h.clearEffects();
        h.endSession();
        (0, globals_1.expect)(h.wasEmitted("v2:session-ended")).toBe(true);
        h.teardown();
    });
    (0, globals_1.test)("v2:session-ended has reason: natural-end", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.expireTimer();
        h.clearEffects();
        h.endSession();
        const data = h.lastEmit("v2:session-ended");
        (0, globals_1.expect)(data.reason).toBe("natural-end");
        h.teardown();
    });
    (0, globals_1.test)("emits SCHEDULE_CLEANUP effect", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.expireTimer();
        h.clearEffects();
        h.endSession();
        const cleanup = h.effects.find((e) => e.type === "SCHEDULE_CLEANUP");
        (0, globals_1.expect)(cleanup).toBeDefined();
        (0, globals_1.expect)(cleanup.delayMs).toBe(60000);
        h.teardown();
    });
    (0, globals_1.test)("invariants hold after END_SESSION", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.expireTimer();
        h.endSession();
        (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
        h.teardown();
    });
});
// ============================================================================
// ADMIN_END_SESSION (Immediate — No Grace Period)
// ============================================================================
(0, globals_1.describe)("ADMIN_END_SESSION", () => {
    (0, globals_1.test)("phase transitions immediately to ENDED (skips ENDING)", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.dispatch(null, {
            type: ActionTypes.ADMIN_END_SESSION,
            payload: { adminId: "admin-user-001" },
        });
        (0, globals_1.expect)(h.phase).toBe("ENDED");
        h.teardown();
    });
    (0, globals_1.test)("liveSpeaker cleared immediately on admin end", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        h.dispatch(null, {
            type: ActionTypes.ADMIN_END_SESSION,
            payload: { adminId: "admin-user-001" },
        });
        (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        h.teardown();
    });
    (0, globals_1.test)("emits v2:session-ended with reason: admin-terminated", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.clearEffects();
        h.dispatch(null, {
            type: ActionTypes.ADMIN_END_SESSION,
            payload: { adminId: "admin-user-001" },
        });
        const data = h.lastEmit("v2:session-ended");
        (0, globals_1.expect)(data.reason).toBe("admin-terminated");
        h.teardown();
    });
    (0, globals_1.test)("does NOT schedule DELAYED_ACTION (no grace period)", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.clearEffects();
        h.dispatch(null, {
            type: ActionTypes.ADMIN_END_SESSION,
            payload: { adminId: "admin-user-001" },
        });
        const delayed = h.effects.find((e) => e.type === "DELAYED_ACTION");
        (0, globals_1.expect)(delayed).toBeUndefined();
        h.teardown();
    });
    (0, globals_1.test)("timer.active is false after admin end", () => {
        const { h } = (0, TestHarness_1.createSessionWithUsers)(2);
        h.dispatch(null, {
            type: ActionTypes.ADMIN_END_SESSION,
            payload: { adminId: "admin-user-001" },
        });
        (0, globals_1.expect)(h.state.timer.active).toBe(false);
        h.teardown();
    });
    (0, globals_1.test)("invariants hold after admin end", () => {
        const { h, speakerUserId } = (0, TestHarness_1.createSessionWithActiveSpeaker)(2);
        h.dispatch(null, {
            type: ActionTypes.ADMIN_END_SESSION,
            payload: { adminId: "admin-user-001" },
        });
        (0, globals_1.expect)(() => (0, invariants_1.assertInvariants)(h.state)).not.toThrow();
        h.teardown();
    });
});

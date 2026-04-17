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

import { describe, test, expect } from "@jest/globals";
import { TestHarness, createSessionWithUsers, createSessionWithActiveSpeaker } from "../harness/TestHarness";
import { assertInvariants } from "../../state/invariants";
import {
  isTimerExpired,
  getRemainingTime,
  isInGracePeriod,
} from "../../state/selectors";
import * as ActionTypes from "../../actions/actionTypes";

// ============================================================================
// TIMER ACTIVATION
// ============================================================================

describe("Timer activation", () => {
  test("timer is inactive before session start", () => {
    const h = new TestHarness();
    h.addUsers(2);

    expect(h.state.timer.active).toBe(false);
    h.teardown();
  });

  test("timer becomes active on session start", () => {
    const { h, users } = createSessionWithUsers(2);

    expect(h.state.timer.active).toBe(true);
    h.teardown();
  });

  test("timer.durationMs matches durationMinutes passed to start", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId, 45);

    expect(h.state.timer.durationMs).toBe(45 * 60 * 1000);
    h.teardown();
  });

  test("timer.endTime is set to startTime + durationMs", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    const before = Date.now();
    h.startSession(alice.userId, 60);
    const after = Date.now();

    const { startTime, durationMs, endTime } = h.state.timer;
    expect(endTime).toBeDefined();
    expect(endTime!).toBeGreaterThanOrEqual(before + durationMs);
    expect(endTime!).toBeLessThanOrEqual(after + durationMs + 50);
    h.teardown();
  });

  test("getRemainingTime returns positive value for a fresh timer", () => {
    const { h } = createSessionWithUsers(2);

    const remaining = getRemainingTime(h.state);
    expect(remaining).toBeGreaterThan(0);
    h.teardown();
  });

  test("isTimerExpired returns false for a fresh timer", () => {
    const { h } = createSessionWithUsers(2);

    expect(isTimerExpired(h.state)).toBe(false);
    h.teardown();
  });

  test("isInGracePeriod returns false before expiry", () => {
    const { h } = createSessionWithUsers(2);

    expect(isInGracePeriod(h.state)).toBe(false);
    h.teardown();
  });
});

// ============================================================================
// TIMER_EXPIRED → ENDING
// ============================================================================

describe("TIMER_EXPIRED", () => {
  test("phase transitions to ENDING", () => {
    const { h } = createSessionWithUsers(2);
    h.expireTimer();

    expect(h.phase).toBe("ENDING");
    h.teardown();
  });

  test("timer.active is false after expiry", () => {
    const { h } = createSessionWithUsers(2);
    h.expireTimer();

    expect(h.state.timer.active).toBe(false);
    h.teardown();
  });

  test("emits v2:session-ending event", () => {
    const { h } = createSessionWithUsers(2);
    h.clearEffects();
    h.expireTimer();

    expect(h.wasEmitted("v2:session-ending")).toBe(true);
    h.teardown();
  });

  test("v2:session-ending includes gracePeriodMs = 30000", () => {
    const { h } = createSessionWithUsers(2);
    h.clearEffects();
    h.expireTimer();

    const data = h.lastEmit("v2:session-ending");
    expect(data.gracePeriodMs).toBe(30000);
    h.teardown();
  });

  test("emits TIMER_CANCEL effect", () => {
    const { h } = createSessionWithUsers(2);
    h.clearEffects();
    h.expireTimer();

    const cancel = h.effects.find((e) => e.type === "TIMER_CANCEL");
    expect(cancel).toBeDefined();
    h.teardown();
  });

  test("schedules DELAYED_ACTION for END_SESSION after 30s", () => {
    const { h } = createSessionWithUsers(2);
    h.clearEffects();
    h.expireTimer();

    const delayed = h.effects.find((e) => e.type === "DELAYED_ACTION") as any;
    expect(delayed).toBeDefined();
    expect(delayed.action.type).toBe("END_SESSION");
    expect(delayed.delayMs).toBe(30000);
    h.teardown();
  });

  test("isInGracePeriod returns true after expiry", () => {
    const { h } = createSessionWithUsers(2);
    h.expireTimer();

    expect(isInGracePeriod(h.state)).toBe(true);
    h.teardown();
  });

  test("expiry while live speaker is active — phase still becomes ENDING", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);

    expect(h.phase).toBe("LIVE_SPEAKER");

    h.expireTimer();

    expect(h.phase).toBe("ENDING");
    h.teardown();
  });

  test("invariants hold after expiry", () => {
    const { h } = createSessionWithUsers(2);
    h.expireTimer();

    expect(() => assertInvariants(h.state)).not.toThrow();
    h.teardown();
  });

  test("double expiry is handled gracefully (idempotent phase)", () => {
    const { h } = createSessionWithUsers(2);
    h.expireTimer();
    // ENDING phase — timer already inactive
    h.expireTimer(); // second call while in ENDING

    // Should not crash or corrupt state — phase may become ENDING again or stay
    expect(h.phase).not.toBe("LOBBY");
    expect(h.phase).not.toBe("ATTENTION_SELECTION");
    expect(() => assertInvariants(h.state)).not.toThrow();
    h.teardown();
  });
});

// ============================================================================
// END_SESSION (Grace Period Expired)
// ============================================================================

describe("END_SESSION", () => {
  test("phase transitions to ENDED", () => {
    const { h } = createSessionWithUsers(2);
    h.expireTimer();
    h.endSession();

    expect(h.phase).toBe("ENDED");
    h.teardown();
  });

  test("liveSpeaker cleared on END_SESSION", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    h.expireTimer();
    h.endSession();

    expect(h.liveSpeaker).toBeNull();
    h.teardown();
  });

  test("speaker role reset to listener on END_SESSION", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;

    expect(speakerP.role).toBe("speaker");

    h.expireTimer();
    h.endSession();

    expect(h.getParticipantById(speakerUserId)!.role).toBe("listener");
    h.teardown();
  });

  test("timer.active is false after END_SESSION", () => {
    const { h } = createSessionWithUsers(2);
    h.expireTimer();
    h.endSession();

    expect(h.state.timer.active).toBe(false);
    h.teardown();
  });

  test("emits v2:session-ended event", () => {
    const { h } = createSessionWithUsers(2);
    h.expireTimer();
    h.clearEffects();
    h.endSession();

    expect(h.wasEmitted("v2:session-ended")).toBe(true);
    h.teardown();
  });

  test("v2:session-ended has reason: natural-end", () => {
    const { h } = createSessionWithUsers(2);
    h.expireTimer();
    h.clearEffects();
    h.endSession();

    const data = h.lastEmit("v2:session-ended");
    expect(data.reason).toBe("natural-end");
    h.teardown();
  });

  test("emits SCHEDULE_CLEANUP effect", () => {
    const { h } = createSessionWithUsers(2);
    h.expireTimer();
    h.clearEffects();
    h.endSession();

    const cleanup = h.effects.find((e) => e.type === "SCHEDULE_CLEANUP") as any;
    expect(cleanup).toBeDefined();
    expect(cleanup.delayMs).toBe(60000);
    h.teardown();
  });

  test("invariants hold after END_SESSION", () => {
    const { h } = createSessionWithUsers(2);
    h.expireTimer();
    h.endSession();

    expect(() => assertInvariants(h.state)).not.toThrow();
    h.teardown();
  });
});

// ============================================================================
// ADMIN_END_SESSION (Immediate — No Grace Period)
// ============================================================================

describe("ADMIN_END_SESSION", () => {
  test("phase transitions immediately to ENDED (skips ENDING)", () => {
    const { h } = createSessionWithUsers(2);

    h.dispatch(null, {
      type: ActionTypes.ADMIN_END_SESSION,
      payload: { adminId: "admin-user-001" },
    });

    expect(h.phase).toBe("ENDED");
    h.teardown();
  });

  test("liveSpeaker cleared immediately on admin end", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);

    h.dispatch(null, {
      type: ActionTypes.ADMIN_END_SESSION,
      payload: { adminId: "admin-user-001" },
    });

    expect(h.liveSpeaker).toBeNull();
    h.teardown();
  });

  test("emits v2:session-ended with reason: admin-terminated", () => {
    const { h } = createSessionWithUsers(2);
    h.clearEffects();

    h.dispatch(null, {
      type: ActionTypes.ADMIN_END_SESSION,
      payload: { adminId: "admin-user-001" },
    });

    const data = h.lastEmit("v2:session-ended");
    expect(data.reason).toBe("admin-terminated");
    h.teardown();
  });

  test("does NOT schedule DELAYED_ACTION (no grace period)", () => {
    const { h } = createSessionWithUsers(2);
    h.clearEffects();

    h.dispatch(null, {
      type: ActionTypes.ADMIN_END_SESSION,
      payload: { adminId: "admin-user-001" },
    });

    const delayed = h.effects.find((e) => e.type === "DELAYED_ACTION");
    expect(delayed).toBeUndefined();
    h.teardown();
  });

  test("timer.active is false after admin end", () => {
    const { h } = createSessionWithUsers(2);

    h.dispatch(null, {
      type: ActionTypes.ADMIN_END_SESSION,
      payload: { adminId: "admin-user-001" },
    });

    expect(h.state.timer.active).toBe(false);
    h.teardown();
  });

  test("invariants hold after admin end", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);

    h.dispatch(null, {
      type: ActionTypes.ADMIN_END_SESSION,
      payload: { adminId: "admin-user-001" },
    });

    expect(() => assertInvariants(h.state)).not.toThrow();
    h.teardown();
  });
});

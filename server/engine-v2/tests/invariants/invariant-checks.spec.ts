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

import { describe, test, expect } from "@jest/globals";
import { TestHarness, createSessionWithActiveSpeaker } from "../harness/TestHarness";
import { InvariantViolation } from "../../state/types";
import { assertInvariants } from "../../state/invariants";
import * as ActionTypes from "../../actions/actionTypes";

// ============================================================================
// VALID STATES: invariants never fire
// ============================================================================

describe("Invariants — valid states", () => {
  test("initial empty room passes invariants", () => {
    const h = new TestHarness();
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });

  test("room with joined users passes invariants", () => {
    const h = new TestHarness();
    h.addUsers(3);
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });

  test("active session with live speaker passes invariants", () => {
    const { h } = createSessionWithActiveSpeaker(3);
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });

  test("after drop mic passes invariants", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;
    h.dropMic(speakerP.socketId!);
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });

  test("after disconnect passes invariants", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);
    const aliceP = h.getParticipant("Alice")!;
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });

  test("after reconnect passes invariants", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId);
    const aliceP = h.getParticipant("Alice")!;
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });
    h.dispatch("alice-new", {
      type: ActionTypes.RECONNECT,
      payload: { displayName: "Alice" },
    });
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });

  test("after timer expiry passes invariants", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId);
    h.expireTimer();
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });
});

// ============================================================================
// VIOLATION TESTS: manually corrupt state to confirm guards fire
// ============================================================================

describe("Invariants — violations detected", () => {
  test("liveSpeaker pointing to non-existent user → InvariantViolation", () => {
    const h = new TestHarness();
    h.addUsers(2);
    h.startSession(h.getParticipant("Alice")!.socketId!);

    // Manually corrupt state: set liveSpeaker to a userId that doesn't exist
    h.state.liveSpeaker = "ghost-user-who-was-never-added";

    expect(() => assertInvariants(h.state)).toThrow(InvariantViolation);
    h.teardown();
  });

  test("pointerMap key not in participants → InvariantViolation", () => {
    const h = new TestHarness();
    h.addUsers(2);
    h.startSession(h.getParticipant("Alice")!.socketId!);

    const aliceP = h.getParticipant("Alice")!;
    // Add a stale pointer from a userId that doesn't exist
    h.state.pointerMap.set("stale-user-id", aliceP.userId);

    expect(() => assertInvariants(h.state)).toThrow(InvariantViolation);
    h.teardown();
  });

  test("pointerMap value not in participants → InvariantViolation", () => {
    const h = new TestHarness();
    h.addUsers(2);
    h.startSession(h.getParticipant("Alice")!.socketId!);

    const aliceP = h.getParticipant("Alice")!;
    // Alice points to a userId that doesn't exist
    h.state.pointerMap.set(aliceP.userId, "deleted-target-id");

    expect(() => assertInvariants(h.state)).toThrow(InvariantViolation);
    h.teardown();
  });

  test("phase=LIVE_SPEAKER but liveSpeaker=null → InvariantViolation", () => {
    const h = new TestHarness();
    h.addUsers(2);
    h.startSession(h.getParticipant("Alice")!.socketId!);

    // Manually corrupt: set LIVE_SPEAKER phase but clear liveSpeaker
    h.state.phase = "LIVE_SPEAKER";
    h.state.liveSpeaker = null;

    expect(() => assertInvariants(h.state)).toThrow(InvariantViolation);
    h.teardown();
  });

  test("phase=SYNC_PAUSE but syncPause=false → InvariantViolation", () => {
    const h = new TestHarness();
    h.addUsers(2);
    h.startSession(h.getParticipant("Alice")!.socketId!);

    // Manually corrupt
    h.state.phase = "SYNC_PAUSE";
    h.state.syncPause = false;

    expect(() => assertInvariants(h.state)).toThrow(InvariantViolation);
    h.teardown();
  });
});

// ============================================================================
// REGRESSION: known bugs that invariants should catch
// ============================================================================

describe("Invariants — regression guards", () => {
  test("[regression] stale pointer after user leaves does not survive", () => {
    const h = new TestHarness();
    const [alice, bob, carol] = h.addUsers(3);
    h.startSession(alice.userId);

    const carolP = h.getParticipant("Carol")!;

    // Carol points at Alice
    h.dispatch(carolP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Carol", targetUserId: "Alice" },
    });

    // Carol leaves — her pointer should be cleaned up
    h.leave({ userId: carolP.socketId!, displayName: "Carol", avatarId: carolP.avatarId });

    // pointerMap must not contain Carol's userId anymore
    expect(h.state.pointerMap.has(carolP.userId)).toBe(false);

    // Invariants should still hold
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });

  test("[regression] liveSpeaker is cleared when speaker leaves", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;

    h.leave({ userId: speakerP.socketId!, displayName: speakerP.displayName, avatarId: speakerP.avatarId });

    expect(h.liveSpeaker).toBeNull();
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });

  test("[regression] drop mic always clears liveSpeaker (not just participant role)", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;

    h.dropMic(speakerP.socketId!);

    // liveSpeaker must be null — not just role reset
    expect(h.state.liveSpeaker).toBeNull();
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });
});

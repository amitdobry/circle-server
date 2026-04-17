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

import { describe, test, expect } from "@jest/globals";
import { TestHarness, createSessionWithActiveSpeaker } from "../harness/TestHarness";
import * as ActionTypes from "../../actions/actionTypes";

// ============================================================================
// DROP_MIC
// ============================================================================

describe("DROP_MIC", () => {
  test("phase transitions LIVE_SPEAKER → ATTENTION_SELECTION", () => {
    const { h, users, speakerUserId } = createSessionWithActiveSpeaker(2);

    expect(h.phase).toBe("LIVE_SPEAKER");

    const speakerP = h.getParticipantById(speakerUserId)!;
    h.dropMic(speakerP.socketId!);

    expect(h.phase).toBe("ATTENTION_SELECTION");
    h.teardown();
  });

  test("liveSpeaker is null after drop", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;

    h.dropMic(speakerP.socketId!);

    expect(h.liveSpeaker).toBeNull();
    h.teardown();
  });

  test("pointerMap is cleared after drop", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(3);
    const speakerP = h.getParticipantById(speakerUserId)!;

    // Confirm pointerMap was populated during consensus
    expect(h.state.pointerMap.size).toBeGreaterThan(0);

    h.dropMic(speakerP.socketId!);

    expect(h.state.pointerMap.size).toBe(0);
    h.teardown();
  });

  test("all participant roles reset to 'listener' after drop", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(3);
    const speakerP = h.getParticipantById(speakerUserId)!;

    expect(speakerP.role).toBe("speaker");

    h.dropMic(speakerP.socketId!);

    for (const p of h.state.participants.values()) {
      expect(p.role).toBe("listener");
    }
    h.teardown();
  });

  test("emits live-speaker-cleared event", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;

    h.clearEffects();
    h.dropMic(speakerP.socketId!);

    expect(h.wasEmitted("live-speaker-cleared")).toBe(true);
    h.teardown();
  });

  test("invariants hold after drop", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;
    h.dropMic(speakerP.socketId!);
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });
});

// ============================================================================
// PASS_MIC
// ============================================================================

describe("PASS_MIC", () => {
  test("phase transitions LIVE_SPEAKER → ATTENTION_SELECTION", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;

    h.passMic(speakerP.socketId!);

    expect(h.phase).toBe("ATTENTION_SELECTION");
    expect(h.liveSpeaker).toBeNull();
    h.teardown();
  });

  test("pointerMap cleared after pass", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(3);
    const speakerP = h.getParticipantById(speakerUserId)!;

    h.passMic(speakerP.socketId!);

    expect(h.state.pointerMap.size).toBe(0);
    h.teardown();
  });

  test("all roles reset to 'listener' after pass", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(3);
    const speakerP = h.getParticipantById(speakerUserId)!;

    h.passMic(speakerP.socketId!);

    for (const p of h.state.participants.values()) {
      expect(p.role).toBe("listener");
    }
    h.teardown();
  });

  test("emits live-speaker-cleared", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;

    h.clearEffects();
    h.passMic(speakerP.socketId!);

    expect(h.wasEmitted("live-speaker-cleared")).toBe(true);
    h.teardown();
  });

  test("invariants hold after pass", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;
    h.passMic(speakerP.socketId!);
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });
});

// ============================================================================
// ACCEPT_MIC
// ============================================================================

describe("ACCEPT_MIC", () => {
  test("user accepts mic → becomes live speaker, phase → LIVE_SPEAKER", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    // Simulate being offered the mic by dispatching ACCEPT_MIC directly
    const bobP = h.getParticipant("Bob")!;
    h.dispatch(bobP.socketId!, { type: ActionTypes.ACCEPT_MIC });

    expect(h.phase).toBe("LIVE_SPEAKER");
    expect(h.liveSpeaker).toBe(bobP.userId);
    h.teardown();
  });

  test("accepter's role becomes 'speaker'", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const bobP = h.getParticipant("Bob")!;
    h.dispatch(bobP.socketId!, { type: ActionTypes.ACCEPT_MIC });

    expect(h.getParticipant("Bob")!.role).toBe("speaker");
    expect(h.getParticipant("Alice")!.role).toBe("listener");
    h.teardown();
  });

  test("ACCEPT_MIC emits live-speaker event", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const bobP = h.getParticipant("Bob")!;
    h.clearEffects();
    h.dispatch(bobP.socketId!, { type: ActionTypes.ACCEPT_MIC });

    expect(h.wasEmitted("live-speaker")).toBe(true);
    const data = h.lastEmit("live-speaker");
    expect(data.userId).toBe(bobP.userId);
    h.teardown();
  });

  test("unknown user cannot accept mic", () => {
    const h = new TestHarness();
    h.addUsers(2);
    h.startSession(h.getParticipant("Alice")!.socketId!);

    const effects = h.dispatch("unknown-socket-xyz", { type: ActionTypes.ACCEPT_MIC });

    // Should produce no useful effects (user not found)
    expect(effects.length).toBe(0);
    h.teardown();
  });
});

// ============================================================================
// DECLINE_MIC
// ============================================================================

describe("DECLINE_MIC", () => {
  test("decliner's pointer removed from pointerMap", () => {
    const h = new TestHarness();
    const [alice, bob, carol] = h.addUsers(3);
    h.startSession(alice.userId);

    const carolP = h.getParticipant("Carol")!;

    // Add a pointer for Carol first
    h.dispatch(carolP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Carol", targetUserId: "Alice" },
    });
    expect(h.state.pointerMap.has(carolP.userId)).toBe(true);

    h.dispatch(carolP.socketId!, { type: ActionTypes.DECLINE_MIC });

    expect(h.state.pointerMap.has(carolP.userId)).toBe(false);
    h.teardown();
  });

  test("phase stays ATTENTION_SELECTION after decline", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const bobP = h.getParticipant("Bob")!;
    h.dispatch(bobP.socketId!, { type: ActionTypes.DECLINE_MIC });

    expect(h.phase).toBe("ATTENTION_SELECTION");
    h.teardown();
  });

  test("decline emits REBUILD_ALL_PANELS effect", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const bobP = h.getParticipant("Bob")!;
    h.clearEffects();
    h.dispatch(bobP.socketId!, { type: ActionTypes.DECLINE_MIC });

    const rebuild = h.effects.find((e) => e.type === "REBUILD_ALL_PANELS");
    expect(rebuild).toBeDefined();
    h.teardown();
  });
});

// ============================================================================
// FULL MIC CYCLE: consensus → live speaker → drop → consensus again
// ============================================================================

describe("Full mic cycle", () => {
  test("consensus → drop → new consensus works cleanly", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const bobP = h.getParticipant("Bob")!;

    // Round 1: Alice speaks
    h.reachConsensusOn(aliceP.userId);
    expect(h.phase).toBe("LIVE_SPEAKER");
    expect(h.liveSpeaker).toBe(aliceP.userId);

    // Alice drops
    h.dropMic(aliceP.socketId!);
    expect(h.phase).toBe("ATTENTION_SELECTION");
    expect(h.liveSpeaker).toBeNull();

    // Round 2: Bob speaks
    h.dispatch(aliceP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Alice", targetUserId: "Bob" },
    });
    h.dispatch(bobP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Bob", targetUserId: "Bob" },
    });

    expect(h.phase).toBe("LIVE_SPEAKER");
    expect(h.liveSpeaker).toBe(bobP.userId);

    h.assertInvariants();
    h.teardown();
  });
});

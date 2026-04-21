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

import { describe, test, expect } from "@jest/globals";
import {
  TestHarness,
  createSessionWithActiveSpeaker,
} from "../harness/TestHarness";
import * as ActionTypes from "../../actions/actionTypes";

// ============================================================================
// DISCONNECT
// ============================================================================

describe("DISCONNECT", () => {
  test("disconnected user becomes GHOST, seat preserved", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });

    const updated = h.getParticipant("Alice")!;
    expect(updated.presence).toBe("GHOST");
    // Participant is still in the map
    expect(h.state.participants.has(aliceP.userId)).toBe(true);
    h.teardown();
  });

  test("disconnected user's socketId becomes null", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });

    expect(h.getParticipant("Alice")!.socketId).toBeNull();
    h.teardown();
  });

  test("speaker disconnects — mic drops immediately (speaker invalidation)", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(3);

    const speakerP = h.getParticipantById(speakerUserId)!;
    h.dispatch(speakerP.socketId!, { type: ActionTypes.DISCONNECT });

    // ✅ NEW BEHAVIOR: Speaker disconnect invalidates speaking moment immediately
    expect(h.liveSpeaker).toBeNull();
    expect(h.phase).toBe("ATTENTION_SELECTION");
    h.teardown();
  });

  test("speaker disconnects — all users gone — liveSpeaker cleared", () => {
    const { h, speakerUserId, users } = createSessionWithActiveSpeaker(2);

    // Disconnect both users
    for (const user of users) {
      const p = h.getParticipant(user.displayName);
      if (p?.presence === "CONNECTED") {
        h.dispatch(p.socketId!, { type: ActionTypes.DISCONNECT });
      }
    }

    expect(h.liveSpeaker).toBeNull();
    expect(h.phase).toBe("ENDING");
    h.teardown();
  });

  test("disconnect emits v2:user-ghosted event", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    h.clearEffects();
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });

    expect(h.wasEmitted("v2:user-ghosted")).toBe(true);
    h.teardown();
  });

  test("invariants hold after disconnect", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(3);
    const speakerP = h.getParticipantById(speakerUserId)!;
    h.dispatch(speakerP.socketId!, { type: ActionTypes.DISCONNECT });
    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });
});

// ============================================================================
// RECONNECT
// ============================================================================

describe("RECONNECT", () => {
  test("ghost user reconnects → presence becomes CONNECTED", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId);

    // Go ghost
    const aliceP = h.getParticipant("Alice")!;
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });
    expect(h.getParticipant("Alice")!.presence).toBe("GHOST");

    // Reconnect
    const newSocket = "alice-socket-v2";
    h.dispatch(newSocket, {
      type: ActionTypes.RECONNECT,
      payload: { displayName: "Alice" },
    });

    expect(h.getParticipant("Alice")!.presence).toBe("CONNECTED");
    h.teardown();
  });

  test("reconnected user gets new socketId", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });

    const newSocket = "alice-new-socket";
    h.dispatch(newSocket, {
      type: ActionTypes.RECONNECT,
      payload: { displayName: "Alice" },
    });

    expect(h.getParticipant("Alice")!.socketId).toBe(newSocket);
    h.teardown();
  });

  test("live speaker reconnects — mic released (fresh participation)", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;
    const speakerName = speakerP.displayName;

    // ✅ NEW BEHAVIOR: Speaker disconnects → mic drops immediately
    h.dispatch(speakerP.socketId!, { type: ActionTypes.DISCONNECT });
    expect(h.liveSpeaker).toBeNull(); // Mic already dropped
    expect(h.phase).toBe("ATTENTION_SELECTION");

    // Speaker reconnects
    const newSocket = "speaker-socket-v2";
    h.dispatch(newSocket, {
      type: ActionTypes.RECONNECT,
      payload: { displayName: speakerName },
    });

    // Reconnect = fresh participation → still no speaker
    expect(h.liveSpeaker).toBeNull();
    expect(h.phase).toBe("ATTENTION_SELECTION");
    h.teardown();
  });

  test("reconnect emits v2:reconnect-state event", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });
    h.clearEffects();

    h.dispatch("alice-new-socket", {
      type: ActionTypes.RECONNECT,
      payload: { displayName: "Alice" },
    });

    expect(h.wasEmitted("v2:reconnect-state")).toBe(true);
    h.teardown();
  });

  test("reconnecting unknown user produces no changes", () => {
    const h = new TestHarness();
    h.addUsers(2);
    h.startSession(h.getParticipant("Alice")!.socketId!);

    const beforeSize = h.state.participants.size;
    h.dispatch("ghost-socket-999", {
      type: ActionTypes.RECONNECT,
      payload: { displayName: "NoBodyHere" },
    });

    expect(h.state.participants.size).toBe(beforeSize);
    h.teardown();
  });

  test("invariants hold after reconnect", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });
    h.dispatch("alice-v2", {
      type: ActionTypes.RECONNECT,
      payload: { displayName: "Alice" },
    });

    expect(() => h.assertInvariants()).not.toThrow();
    h.teardown();
  });
});

// ============================================================================
// MID-SESSION JOIN
// ============================================================================

describe("Mid-session join", () => {
  test("user joins during ATTENTION_SELECTION — added without disrupting phase", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    expect(h.phase).toBe("ATTENTION_SELECTION");

    const carol = h.addUser("Carol");

    expect(h.state.participants.size).toBe(3);
    expect(h.phase).toBe("ATTENTION_SELECTION");
    h.teardown();
  });

  test("user joins during LIVE_SPEAKER — phase unchanged, liveSpeaker unchanged", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);

    expect(h.phase).toBe("LIVE_SPEAKER");

    const carol = h.addUser("Carol");

    expect(h.phase).toBe("LIVE_SPEAKER");
    expect(h.liveSpeaker).toBe(speakerUserId);
    h.teardown();
  });

  test("late joiner does not get included in existing pointerMap consensus check", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    // Alice and Bob both point to Alice (consensus achieved)
    const aliceP = h.getParticipant("Alice")!;
    const bobP = h.getParticipant("Bob")!;

    h.dispatch(aliceP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Alice", targetUserId: "Alice" },
    });
    h.dispatch(bobP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Bob", targetUserId: "Alice" },
    });

    expect(h.phase).toBe("LIVE_SPEAKER");

    // Carol joins after consensus — doesn't break it
    h.addUser("Carol");

    // Phase should remain LIVE_SPEAKER (Carol hasn't disrupted pointers)
    expect(h.phase).toBe("LIVE_SPEAKER");
    expect(h.liveSpeaker).toBe(aliceP.userId);

    h.assertInvariants();
    h.teardown();
  });
});

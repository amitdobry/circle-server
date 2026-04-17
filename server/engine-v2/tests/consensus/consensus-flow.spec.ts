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

import { describe, test, expect, afterEach } from "@jest/globals";
import { TestHarness } from "../harness/TestHarness";
import * as ActionTypes from "../../actions/actionTypes";

describe("Consensus Flow", () => {
  // ==========================================================================
  // UNANIMOUS CONSENSUS
  // ==========================================================================

  describe("unanimous consensus → LIVE_SPEAKER", () => {
    test("2-user room: both point to same user → phase becomes LIVE_SPEAKER", () => {
      const h = new TestHarness();
      const [alice, bob] = h.addUsers(2);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;
      h.reachConsensusOn(aliceP.userId);

      expect(h.phase).toBe("LIVE_SPEAKER");
      expect(h.liveSpeaker).toBe(aliceP.userId);
      h.teardown();
    });

    test("3-user room: all three point to same user → phase becomes LIVE_SPEAKER", () => {
      const h = new TestHarness();
      const [alice, bob, carol] = h.addUsers(3);
      h.startSession(alice.userId);

      const carolP = h.getParticipant("Carol")!;
      h.reachConsensusOn(carolP.userId);

      expect(h.phase).toBe("LIVE_SPEAKER");
      expect(h.liveSpeaker).toBe(carolP.userId);
      h.teardown();
    });

    test("consensus emits live-speaker event", () => {
      const h = new TestHarness();
      const [alice, bob] = h.addUsers(2);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;
      h.clearEffects();
      h.reachConsensusOn(aliceP.userId);

      expect(h.wasEmitted("live-speaker")).toBe(true);
      const data = h.lastEmit("live-speaker");
      expect(data.userId).toBe(aliceP.userId);
      h.teardown();
    });

    test("speaker's role becomes 'speaker', all others become 'listener'", () => {
      const h = new TestHarness();
      const [alice, bob, carol] = h.addUsers(3);
      h.startSession(alice.userId);

      const bobP = h.getParticipant("Bob")!;
      h.reachConsensusOn(bobP.userId);

      expect(h.getParticipant("Bob")!.role).toBe("speaker");
      expect(h.getParticipant("Alice")!.role).toBe("listener");
      expect(h.getParticipant("Carol")!.role).toBe("listener");
      h.teardown();
    });
  });

  // ==========================================================================
  // PARTIAL CONSENSUS
  // ==========================================================================

  describe("partial consensus → no phase change", () => {
    test("2-user room: only one user points → no consensus", () => {
      const h = new TestHarness();
      const [alice, bob] = h.addUsers(2);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;
      const bobP = h.getParticipant("Bob")!;

      // Only Alice points to Bob
      h.dispatch(aliceP.socketId!, {
        type: ActionTypes.POINT_TO_USER,
        payload: { from: "Alice", targetUserId: "Bob" },
      });

      expect(h.phase).toBe("ATTENTION_SELECTION");
      expect(h.liveSpeaker).toBeNull();
      h.teardown();
    });

    test("3-user room: 2-of-3 point to same → no consensus (need all)", () => {
      const h = new TestHarness();
      const [alice, bob, carol] = h.addUsers(3);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;
      const bobP = h.getParticipant("Bob")!;

      // Alice and Bob point to Carol, Carol points elsewhere
      h.dispatch(aliceP.socketId!, {
        type: ActionTypes.POINT_TO_USER,
        payload: { from: "Alice", targetUserId: "Carol" },
      });
      h.dispatch(bobP.socketId!, {
        type: ActionTypes.POINT_TO_USER,
        payload: { from: "Bob", targetUserId: "Carol" },
      });

      expect(h.phase).toBe("ATTENTION_SELECTION");
      expect(h.liveSpeaker).toBeNull();
      h.teardown();
    });
  });

  // ==========================================================================
  // CONSENSUS BROKEN
  // ==========================================================================

  describe("consensus broken → back to ATTENTION_SELECTION", () => {
    test("re-point during LIVE_SPEAKER → phase drops, liveSpeaker cleared", () => {
      const h = new TestHarness();
      const [alice, bob, carol] = h.addUsers(3);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;
      h.reachConsensusOn(aliceP.userId);
      expect(h.phase).toBe("LIVE_SPEAKER");

      // Carol re-points to someone else
      const carolP = h.getParticipant("Carol")!;
      const bobP = h.getParticipant("Bob")!;
      h.dispatch(carolP.socketId!, {
        type: ActionTypes.POINT_TO_USER,
        payload: { from: "Carol", targetUserId: "Bob" },
      });

      expect(h.phase).toBe("ATTENTION_SELECTION");
      expect(h.liveSpeaker).toBeNull();
      h.teardown();
    });

    test("broken consensus emits live-speaker-cleared event", () => {
      const h = new TestHarness();
      const [alice, bob] = h.addUsers(2);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;
      h.reachConsensusOn(aliceP.userId);

      h.clearEffects();

      // Bob re-points to himself — breaks consensus
      const bobP = h.getParticipant("Bob")!;
      h.dispatch(bobP.socketId!, {
        type: ActionTypes.POINT_TO_USER,
        payload: { from: "Bob", targetUserId: "Bob" },
      });

      expect(h.wasEmitted("live-speaker-cleared")).toBe(true);
      h.teardown();
    });
  });

  // ==========================================================================
  // GHOST EXCLUSION
  // ==========================================================================

  describe("ghost users excluded from consensus quorum", () => {
    test("3-user room: 1 ghost + 2 connected all pointing same → consensus", () => {
      const h = new TestHarness();
      const [alice, bob, carol] = h.addUsers(3);
      h.startSession(alice.userId);

      // Carol disconnects (becomes ghost)
      const carolP = h.getParticipant("Carol")!;
      h.dispatch(carolP.socketId!, { type: ActionTypes.DISCONNECT });
      expect(h.getParticipant("Carol")!.presence).toBe("GHOST");

      // Alice and Bob (the 2 connected) both point to Alice
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

      // 2/2 connected users agree → consensus
      expect(h.phase).toBe("LIVE_SPEAKER");
      expect(h.liveSpeaker).toBe(aliceP.userId);
      h.teardown();
    });
  });

  // ==========================================================================
  // POINTER MAP INTEGRITY
  // ==========================================================================

  describe("pointer map integrity", () => {
    test("POINT_TO_USER updates pointerMap[fromId] → toId", () => {
      const h = new TestHarness();
      const [alice, bob] = h.addUsers(2);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;
      const bobP = h.getParticipant("Bob")!;

      h.dispatch(aliceP.socketId!, {
        type: ActionTypes.POINT_TO_USER,
        payload: { from: "Alice", targetUserId: "Bob" },
      });

      expect(h.state.pointerMap.get(aliceP.userId)).toBe(bobP.userId);
      h.teardown();
    });

    test("re-pointing updates the existing pointer (no duplicates)", () => {
      const h = new TestHarness();
      const [alice, bob, carol] = h.addUsers(3);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;

      h.dispatch(aliceP.socketId!, {
        type: ActionTypes.POINT_TO_USER,
        payload: { from: "Alice", targetUserId: "Bob" },
      });
      h.dispatch(aliceP.socketId!, {
        type: ActionTypes.POINT_TO_USER,
        payload: { from: "Alice", targetUserId: "Carol" },
      });

      const carolP = h.getParticipant("Carol")!;
      expect(h.state.pointerMap.get(aliceP.userId)).toBe(carolP.userId);
      // Still only 1 pointer from Alice, not 2
      expect(h.state.pointerMap.size).toBe(1);
      h.teardown();
    });
  });
});

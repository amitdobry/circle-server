/**
 * Session Lifecycle Tests
 *
 * Covers:
 *   - Join / multi-join
 *   - Avatar conflict
 *   - Session start (LOBBY → ATTENTION_SELECTION)
 *   - Leave during lobby
 *   - Timer expiry → ENDING → END_SESSION → ENDED
 *   - Admin end session
 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { TestHarness } from "../harness/TestHarness";

describe("Session Lifecycle", () => {
  let h: TestHarness;

  afterEach(() => {
    h.teardown();
  });

  // ==========================================================================
  // JOIN
  // ==========================================================================

  describe("JOIN_SESSION", () => {
    beforeEach(() => {
      h = new TestHarness();
    });

    test("first user joins → participant added, phase stays LOBBY", () => {
      const alice = h.addUser("Alice");

      expect(h.state.participants.size).toBe(1);
      expect(h.phase).toBe("LOBBY");

      const p = h.getParticipant("Alice")!;
      expect(p).toBeDefined();
      expect(p.displayName).toBe("Alice");
      expect(p.presence).toBe("CONNECTED");
      expect(p.role).toBe("listener");
    });

    test("multiple users join → all added", () => {
      h.addUser("Alice");
      h.addUser("Bob");
      h.addUser("Carol");

      expect(h.state.participants.size).toBe(3);
      expect(h.connectedUsers.length).toBe(3);
    });

    test("avatar conflict is rejected when avatar already taken by CONNECTED user", () => {
      h.addUser("Alice", "avatar-panda");

      const bob = h.makeUser("Bob", "avatar-panda"); // same avatar
      const effects = h.dispatch(bob.userId, {
        type: "JOIN_SESSION",
        payload: {
          displayName: "Bob",
          avatarId: "avatar-panda",
          socketId: bob.userId,
        },
      });

      // Bob should NOT be added
      expect(h.state.participants.size).toBe(1);

      // A join-rejected event should be emitted
      expect(h.wasEmitted("join-rejected")).toBe(true);
    });

    test("same user joins twice → presence updated to CONNECTED (reconnect path)", () => {
      const alice = h.addUser("Alice");
      // Dispatch JOIN again with same userId
      h.dispatch(alice.userId, {
        type: "JOIN_SESSION",
        payload: {
          displayName: "Alice",
          avatarId: "avatar-1",
          socketId: alice.userId,
        },
      });

      // Should still be only 1 participant
      expect(h.state.participants.size).toBe(1);
      expect(h.getParticipant("Alice")!.presence).toBe("CONNECTED");
    });

    test("join emits v2:user-joined event", () => {
      h.addUser("Alice");
      expect(h.wasEmitted("v2:user-joined")).toBe(true);
    });
  });

  // ==========================================================================
  // SESSION START
  // ==========================================================================

  describe("CLICK_READY_TO_GLOW (session start)", () => {
    beforeEach(() => {
      h = new TestHarness();
    });

    test("valid start → phase transitions LOBBY → ATTENTION_SELECTION", () => {
      const alice = h.addUser("Alice");
      h.startSession(alice.userId);

      expect(h.phase).toBe("ATTENTION_SELECTION");
    });

    test("timer is activated on session start", () => {
      const alice = h.addUser("Alice");
      h.startSession(alice.userId, 30);

      expect(h.state.timer.active).toBe(true);
      expect(h.state.timer.durationMs).toBe(30 * 60 * 1000);
    });

    test("start emits v2:session-started event", () => {
      const alice = h.addUser("Alice");
      h.clearEffects();
      h.startSession(alice.userId);

      expect(h.wasEmitted("v2:session-started")).toBe(true);
    });

    test("start from wrong phase is ignored", () => {
      const alice = h.addUser("Alice");
      h.startSession(alice.userId); // LOBBY → ATTENTION_SELECTION

      h.clearEffects();
      const effects = h.startSession(alice.userId); // already in ATTENTION_SELECTION

      expect(h.phase).toBe("ATTENTION_SELECTION"); // no change
      expect(effects.length).toBe(0);
    });

    test("unknown userId cannot start session", () => {
      const effects = h.dispatch("ghost-socket", {
        type: "CLICK_READY_TO_GLOW",
        payload: { durationMinutes: 60 },
      });

      expect(h.phase).toBe("LOBBY");
    });
  });

  // ==========================================================================
  // LEAVE
  // ==========================================================================

  describe("LEAVE_SESSION", () => {
    beforeEach(() => {
      h = new TestHarness();
    });

    test("user leaves → removed from participants", () => {
      const alice = h.addUser("Alice");
      const bob = h.addUser("Bob");

      h.leave(alice);

      expect(h.state.participants.has(h.getParticipant("Alice")?.userId ?? "")).toBe(false);
      expect(h.state.participants.size).toBe(1);
    });

    test("speaker leaves → liveSpeaker cleared, phase drops to ATTENTION_SELECTION", () => {
      // Set up a live-speaker scenario in a fresh nested harness
      const h2 = new TestHarness();
      const [alice, bob] = h2.addUsers(2);
      h2.startSession(alice.userId);
      const aliceP = h2.getParticipant(alice.displayName)!;
      h2.reachConsensusOn(aliceP.userId);

      expect(h2.phase).toBe("LIVE_SPEAKER");
      expect(h2.liveSpeaker).toBe(aliceP.userId);

      // Alice leaves
      h2.leave(alice);

      expect(h2.liveSpeaker).toBeNull();
      expect(h2.phase).toBe("ATTENTION_SELECTION");

      h2.teardown();
    });
  });

  // ==========================================================================
  // TIMER EXPIRY
  // ==========================================================================

  describe("TIMER_EXPIRED → END_SESSION", () => {
    beforeEach(() => {
      h = new TestHarness();
    });

    test("timer expires → phase becomes ENDING", () => {
      const alice = h.addUser("Alice");
      h.startSession(alice.userId);

      h.expireTimer();

      expect(h.phase).toBe("ENDING");
      expect(h.state.timer.active).toBe(false);
    });

    test("timer expiry emits v2:session-ending", () => {
      const alice = h.addUser("Alice");
      h.startSession(alice.userId);
      h.clearEffects();
      h.expireTimer();

      expect(h.wasEmitted("v2:session-ending")).toBe(true);
    });

    test("END_SESSION → phase becomes ENDED", () => {
      const alice = h.addUser("Alice");
      h.startSession(alice.userId);
      h.expireTimer();

      h.endSession();

      expect(h.phase).toBe("ENDED");
      expect(h.liveSpeaker).toBeNull();
    });

    test("END_SESSION emits v2:session-ended", () => {
      const alice = h.addUser("Alice");
      h.startSession(alice.userId);
      h.expireTimer();
      h.clearEffects();
      h.endSession();

      expect(h.wasEmitted("v2:session-ended")).toBe(true);
    });

    test("timer expiry schedules delayed END_SESSION action", () => {
      const alice = h.addUser("Alice");
      h.startSession(alice.userId);
      h.clearEffects();
      h.expireTimer();

      const delayed = h.effects.find((e) => e.type === "DELAYED_ACTION") as any;
      expect(delayed).toBeDefined();
      expect(delayed.action.type).toBe("END_SESSION");
      expect(delayed.delayMs).toBe(30000);
    });
  });
});

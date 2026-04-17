/**
 * Multi-Room Smoke Tests
 *
 * Validates that multiple rooms coexist with complete state isolation.
 * No state, pointers, speakers, or effects should leak between rooms.
 *
 * Covers:
 *   - Two rooms active simultaneously, independent phases
 *   - Consensus in room A does not affect room B
 *   - Speaker in room A does not appear in room B
 *   - Disconnect in one room does not affect another
 *   - Timer expiry in one room does not affect another
 *   - Registry counts rooms correctly
 *   - clearAll() wipes all rooms
 *   - Same userId in two rooms is tracked independently
 *   - Event emissions are room-scoped (SOCKET_EMIT_ROOM carries correct roomId)
 *   - Destroying one room does not destroy another
 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import { TestHarness, createSessionWithUsers, createSessionWithActiveSpeaker } from "../harness/TestHarness";
import { roomRegistry } from "../../registry/RoomRegistry";
import { assertInvariants } from "../../state/invariants";
import * as ActionTypes from "../../actions/actionTypes";

// ============================================================================
// ROOM ISOLATION — PHASE INDEPENDENCE
// ============================================================================

describe("Multi-room smoke", () => {
  describe("room isolation — phase independence", () => {
    test("two rooms start in LOBBY independently", () => {
      const h1 = new TestHarness("room-a");
      const h2 = new TestHarness("room-b");

      h1.addUsers(2);
      h2.addUsers(2);

      expect(h1.phase).toBe("LOBBY");
      expect(h2.phase).toBe("LOBBY");

      h1.teardown();
      h2.teardown();
    });

    test("starting session in room A does not affect room B", () => {
      const h1 = new TestHarness("room-iso-1");
      const h2 = new TestHarness("room-iso-2");

      const [a1] = h1.addUsers(1);
      h2.addUsers(1);

      h1.startSession(a1.userId);

      expect(h1.phase).toBe("ATTENTION_SELECTION");
      expect(h2.phase).toBe("LOBBY"); // untouched

      h1.teardown();
      h2.teardown();
    });

    test("consensus in room A does not set live speaker in room B", () => {
      const { h: hA, speakerUserId: speakerA } = createSessionWithActiveSpeaker(2);
      const { h: hB } = createSessionWithUsers(2);

      expect(hA.liveSpeaker).toBe(speakerA);
      expect(hB.liveSpeaker).toBeNull();
      expect(hB.phase).toBe("ATTENTION_SELECTION");

      hA.teardown();
      hB.teardown();
    });
  });

  // ==========================================================================
  // ROOM ISOLATION — STATE DOES NOT LEAK
  // ==========================================================================

  describe("room isolation — state does not leak", () => {
    test("participants in room A are not visible in room B", () => {
      const h1 = new TestHarness("room-pl-1");
      const h2 = new TestHarness("room-pl-2");

      h1.addUser("Alice");
      h1.addUser("Bob");
      h2.addUser("Charlie");

      expect(h1.state.participants.size).toBe(2);
      expect(h2.state.participants.size).toBe(1);
      expect(h2.getParticipant("Alice")).toBeUndefined();
      expect(h2.getParticipant("Bob")).toBeUndefined();

      h1.teardown();
      h2.teardown();
    });

    test("pointerMap in room A does not affect room B", () => {
      const h1 = new TestHarness("room-ptr-1");
      const h2 = new TestHarness("room-ptr-2");

      const [a1, b1] = h1.addUsers(2);
      h1.startSession(a1.userId);

      const a1P = h1.getParticipant("Alice")!;
      h1.dispatch(a1P.socketId!, {
        type: ActionTypes.POINT_TO_USER,
        payload: { from: "Alice", targetUserId: "Bob" },
      });

      expect(h1.state.pointerMap.size).toBe(1);
      expect(h2.state.pointerMap.size).toBe(0); // completely isolated

      h1.teardown();
      h2.teardown();
    });

    test("dropping mic in room A does not affect room B live speaker", () => {
      const { h: hA, speakerUserId: speakerA } = createSessionWithActiveSpeaker(2);
      const { h: hB, speakerUserId: speakerB } = createSessionWithActiveSpeaker(2);

      const speakerAP = hA.getParticipantById(speakerA)!;
      hA.dropMic(speakerAP.socketId!);

      // Room A: speaker cleared
      expect(hA.liveSpeaker).toBeNull();

      // Room B: completely unaffected
      expect(hB.liveSpeaker).toBe(speakerB);
      expect(hB.phase).toBe("LIVE_SPEAKER");

      hA.teardown();
      hB.teardown();
    });

    test("disconnect in room A does not ghost users in room B", () => {
      const h1 = new TestHarness("room-dc-1");
      const h2 = new TestHarness("room-dc-2");

      const [alice1] = h1.addUsers(2);
      const [alice2] = h2.addUsers(2);
      h1.startSession(alice1.userId);
      h2.startSession(alice2.userId);

      const alice1P = h1.getParticipant("Alice")!;
      h1.dispatch(alice1P.socketId!, { type: ActionTypes.DISCONNECT });

      // Room 1: Alice is ghost
      expect(h1.getParticipant("Alice")!.presence).toBe("GHOST");

      // Room 2: Alice is still connected (different room, different participant object)
      expect(h2.getParticipant("Alice")!.presence).toBe("CONNECTED");

      h1.teardown();
      h2.teardown();
    });

    test("timer expiry in room A does not expire room B timer", () => {
      const { h: hA } = createSessionWithUsers(2);
      const { h: hB } = createSessionWithUsers(2);

      hA.expireTimer();

      expect(hA.phase).toBe("ENDING");
      expect(hA.state.timer.active).toBe(false);

      expect(hB.phase).toBe("ATTENTION_SELECTION");
      expect(hB.state.timer.active).toBe(true); // still running

      hA.teardown();
      hB.teardown();
    });
  });

  // ==========================================================================
  // SAME USER IN MULTIPLE ROOMS
  // ==========================================================================

  describe("same userId in multiple rooms", () => {
    test("same displayName in two rooms tracked as independent participants", () => {
      const h1 = new TestHarness("room-su-1");
      const h2 = new TestHarness("room-su-2");

      h1.addUser("Alice");
      h2.addUser("Alice");

      const alice1 = h1.getParticipant("Alice")!;
      const alice2 = h2.getParticipant("Alice")!;

      // Same display name but independent participant objects in each room
      expect(alice1).toBeDefined();
      expect(alice2).toBeDefined();
      // They're different room-local objects
      expect(alice1).not.toBe(alice2);

      h1.teardown();
      h2.teardown();
    });

    test("state mutation for Alice in room 1 does not affect Alice in room 2", () => {
      const h1 = new TestHarness("room-ms-1");
      const h2 = new TestHarness("room-ms-2");

      const [a1] = h1.addUsers(1);
      const [a2] = h2.addUsers(1);
      h1.startSession(a1.userId);
      h2.startSession(a2.userId);

      // Disconnect Alice in room 1
      const alice1P = h1.getParticipant("Alice")!;
      h1.dispatch(alice1P.socketId!, { type: ActionTypes.DISCONNECT });

      // Alice in room 2 still connected
      expect(h2.getParticipant("Alice")!.presence).toBe("CONNECTED");

      h1.teardown();
      h2.teardown();
    });
  });

  // ==========================================================================
  // EFFECT SCOPING
  // ==========================================================================

  describe("effect scoping", () => {
    test("SOCKET_EMIT_ROOM effects carry the correct roomId", () => {
      const h1 = new TestHarness("room-eff-1");
      const h2 = new TestHarness("room-eff-2");

      const [a1] = h1.addUsers(2);
      const [a2] = h2.addUsers(2);

      h1.clearEffects();
      h1.startSession(a1.userId);

      const roomEmits = h1.effects.filter((e) => e.type === "SOCKET_EMIT_ROOM") as any[];
      expect(roomEmits.length).toBeGreaterThan(0);
      for (const emit of roomEmits) {
        expect(emit.roomId).toBe("room-eff-1");
        expect(emit.roomId).not.toBe("room-eff-2");
      }

      h1.teardown();
      h2.teardown();
    });

    test("REBUILD_ALL_PANELS effects are scoped to correct room", () => {
      const { h: hA, speakerUserId } = createSessionWithActiveSpeaker(2);
      const { h: hB } = createSessionWithUsers(2);

      const speakerP = hA.getParticipantById(speakerUserId)!;
      hA.clearEffects();
      hA.dropMic(speakerP.socketId!);

      const rebuilds = hA.effects.filter((e) => e.type === "REBUILD_ALL_PANELS") as any[];
      for (const r of rebuilds) {
        expect(r.roomId).toBe(hA.roomId);
        expect(r.roomId).not.toBe(hB.roomId);
      }

      hA.teardown();
      hB.teardown();
    });
  });

  // ==========================================================================
  // REGISTRY OPERATIONS
  // ==========================================================================

  describe("registry operations", () => {
    test("registry tracks correct room count", () => {
      const countBefore = roomRegistry.getRoomCount();

      const h1 = new TestHarness();
      const h2 = new TestHarness();
      const h3 = new TestHarness();

      expect(roomRegistry.getRoomCount()).toBe(countBefore + 3);

      h1.teardown();
      h2.teardown();
      h3.teardown();

      expect(roomRegistry.getRoomCount()).toBe(countBefore);
    });

    test("destroying one room does not affect another", () => {
      const h1 = new TestHarness("room-destroy-1");
      const h2 = new TestHarness("room-destroy-2");

      h1.addUsers(2);
      h2.addUsers(2);

      h1.teardown(); // Destroy room 1

      // Room 2 still accessible with correct state
      expect(roomRegistry.hasRoom("room-destroy-2")).toBe(true);
      expect(roomRegistry.hasRoom("room-destroy-1")).toBe(false);
      expect(h2.state.participants.size).toBe(2);

      h2.teardown();
    });

    test("getOrCreateRoom returns the same object for the same roomId", () => {
      const h = new TestHarness("room-same-ref");
      h.addUsers(2);

      const ref1 = roomRegistry.getOrCreateRoom("room-same-ref");
      const ref2 = roomRegistry.getOrCreateRoom("room-same-ref");

      expect(ref1).toBe(ref2); // Same object in memory

      h.teardown();
    });

    test("creating a room that already exists throws", () => {
      const h = new TestHarness("room-conflict");

      expect(() => {
        roomRegistry.createRoom("room-conflict"); // Already exists
      }).toThrow();

      h.teardown();
    });
  });

  // ==========================================================================
  // THREE-ROOM CONCURRENT SCENARIO
  // ==========================================================================

  describe("three-room concurrent scenario", () => {
    test("three rooms each reach consensus on different speakers simultaneously", () => {
      const { h: h1, speakerUserId: s1 } = createSessionWithActiveSpeaker(2);
      const { h: h2, speakerUserId: s2 } = createSessionWithActiveSpeaker(3);
      const { h: h3, speakerUserId: s3 } = createSessionWithActiveSpeaker(2);

      // All three rooms independently in LIVE_SPEAKER
      expect(h1.phase).toBe("LIVE_SPEAKER");
      expect(h2.phase).toBe("LIVE_SPEAKER");
      expect(h3.phase).toBe("LIVE_SPEAKER");

      // Each has their own independent speaker
      expect(h1.liveSpeaker).toBe(s1);
      expect(h2.liveSpeaker).toBe(s2);
      expect(h3.liveSpeaker).toBe(s3);

      // Drop mic in room 2 only
      const s2P = h2.getParticipantById(s2)!;
      h2.dropMic(s2P.socketId!);

      // Room 2 changed
      expect(h2.phase).toBe("ATTENTION_SELECTION");
      expect(h2.liveSpeaker).toBeNull();

      // Rooms 1 and 3 completely unaffected
      expect(h1.phase).toBe("LIVE_SPEAKER");
      expect(h1.liveSpeaker).toBe(s1);
      expect(h3.phase).toBe("LIVE_SPEAKER");
      expect(h3.liveSpeaker).toBe(s3);

      // All invariants hold
      expect(() => assertInvariants(h1.state)).not.toThrow();
      expect(() => assertInvariants(h2.state)).not.toThrow();
      expect(() => assertInvariants(h3.state)).not.toThrow();

      h1.teardown();
      h2.teardown();
      h3.teardown();
    });
  });
});

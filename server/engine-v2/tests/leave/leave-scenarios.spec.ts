/**
 * LEAVE_SESSION Scenarios - Comprehensive Test Suite
 *
 * Tests explicit table exit via Leave button
 *
 * Core Principle: "LEAVE_SESSION = immediate removal, DISCONNECT = ghost (temporary)"
 *
 * Key Distinctions:
 *   - LEAVE_SESSION: Complete removal, no ghost, no reconnect
 *   - DISCONNECT: Ghost created, seat preserved, reconnect allowed
 *
 * Coverage:
 *   1. Basic LEAVE_SESSION Behavior
 *   2. LEAVE_SESSION vs DISCONNECT Distinction
 *   3. LEAVE_SESSION Clears Speaker
 *   4. LEAVE_SESSION Updates Consensus
 *   5. LEAVE_SESSION During All Phases
 *   6. Multi-User LEAVE_SESSION Scenarios
 *   7. Edge Cases
 */

import { describe, test, expect } from "@jest/globals";
import {
  TestHarness,
  createSessionWithActiveSpeaker,
} from "../harness/TestHarness";
import * as ActionTypes from "../../actions/actionTypes";

// ============================================================================
// 1. BASIC LEAVE BEHAVIOR
// ============================================================================

describe("Basic LEAVE_SESSION Behavior", () => {
  test("LEAVE removes participant immediately (no ghost)", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const aliceUserId = aliceP.userId;

    // Alice leaves
    h.dispatch(aliceP.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });

    // Alice should be completely gone (not a ghost)
    expect(h.getParticipant("Alice")).toBeUndefined();
    expect(h.state.participants.has(aliceUserId)).toBe(false);
    expect(h.state.participants.size).toBe(1); // Only Bob remains

    h.teardown();
  });

  test("LEAVE clears all references (pointerMap, speaker)", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const bobP = h.getParticipant("Bob")!;

    // Alice points to Bob
    h.dispatch(aliceP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Alice", targetUserId: bobP.userId },
    });

    expect(h.state.pointerMap.has(aliceP.userId)).toBe(true);

    // Alice leaves
    h.dispatch(aliceP.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });

    // Pointer should be cleared
    expect(h.state.pointerMap.has(aliceP.userId)).toBe(false);

    h.teardown();
  });

  test("LEAVE_SESSION logs system message", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;

    // Alice leaves
    const effects = h.dispatch(aliceP.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });

    // Should log system message
    const logEvent = effects.find((e) => e.type === "SYSTEM_LOG");
    expect(logEvent).toBeDefined();
    if (logEvent && logEvent.type === "SYSTEM_LOG") {
      expect(logEvent.message).toContain("Alice");
      expect(logEvent.message).toContain("left the circle");
    }

    h.teardown();
  });

  test("LEAVE triggers REBUILD_ALL_PANELS", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;

    const effects = h.dispatch(aliceP.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });

    // Should rebuild panels
    const rebuildEffect = effects.find((e) => e.type === "REBUILD_ALL_PANELS");
    expect(rebuildEffect).toBeDefined();

    h.teardown();
  });

  test("LEAVE of non-existent user handled gracefully", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId);

    // Try to leave with non-existent socket
    const effects = h.dispatch("fake-socket-id", {
      type: ActionTypes.LEAVE_SESSION,
    });

    // Should not crash, no effects
    expect(effects).toEqual([]);

    h.teardown();
  });
});

// ============================================================================
// 2. LEAVE vs DISCONNECT DISTINCTION
// ============================================================================

describe("LEAVE_SESSION vs DISCONNECT Distinction", () => {
  test("DISCONNECT creates ghost, LEAVE does not", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const bobP = h.getParticipant("Bob")!;

    // Alice disconnects → becomes ghost
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });
    expect(h.getParticipant("Alice")!.presence).toBe("GHOST");
    expect(h.state.participants.size).toBe(2); // Still 2 (Alice ghost + Bob)

    // Bob leaves → completely removed
    h.dispatch(bobP.socketId!, { type: ActionTypes.LEAVE_SESSION });
    expect(h.getParticipant("Bob")).toBeUndefined();
    expect(h.state.participants.size).toBe(1); // Only Alice ghost remains

    // Phase should be ENDING (all connected users gone)
    expect(h.phase).toBe("ENDING");

    h.teardown();
  });

  test("LEAVE does NOT schedule purge (no delayed action)", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;

    const effects = h.dispatch(aliceP.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });

    // Should NOT have delayed purge action (unlike DISCONNECT)
    const delayedAction = effects.find((e) => e.type === "DELAYED_ACTION");
    expect(delayedAction).toBeUndefined();

    h.teardown();
  });

  test("LEAVE cannot be reconnected", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const aliceDisplayName = aliceP.displayName;

    // Alice leaves
    h.dispatch(aliceP.socketId!, { type: ActionTypes.LEAVE_SESSION });

    // Try to reconnect
    h.dispatch("alice-new-socket", {
      type: ActionTypes.RECONNECT,
      payload: { displayName: aliceDisplayName },
    });

    // Should not find Alice (no ghost to reconnect to)
    expect(h.getParticipant("Alice")).toBeUndefined();

    h.teardown();
  });

  test("DISCONNECT preserves seat, LEAVE does not", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const aliceUserId = aliceP.userId;
    const aliceAvatarId = aliceP.avatarId;

    const bobP = h.getParticipant("Bob")!;
    const bobUserId = bobP.userId;
    const bobAvatarId = bobP.avatarId;

    // Alice disconnects → seat preserved
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });
    expect(h.getParticipantById(aliceUserId)).toBeDefined();
    expect(h.getParticipantById(aliceUserId)!.avatarId).toBe(aliceAvatarId);

    // Bob leaves → seat removed
    h.dispatch(bobP.socketId!, { type: ActionTypes.LEAVE_SESSION });
    expect(h.getParticipantById(bobUserId)).toBeUndefined();

    // Phase should be ENDING (only ghost remains)
    expect(h.phase).toBe("ENDING");

    h.teardown();
  });
});

// ============================================================================
// 3. LEAVE CLEARS SPEAKER
// ============================================================================

describe("LEAVE_SESSION Clears Speaker", () => {
  test("speaker leaves → liveSpeaker cleared", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;

    expect(h.liveSpeaker).toBe(speakerUserId);
    expect(h.phase).toBe("LIVE_SPEAKER");

    // Speaker leaves
    h.dispatch(speakerP.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });

    // liveSpeaker cleared, phase transitions
    expect(h.liveSpeaker).toBeNull();
    expect(h.phase).toBe("ATTENTION_SELECTION");

    h.teardown();
  });

  test("speaker leaves → other participants can continue", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(3);
    const speakerP = h.getParticipantById(speakerUserId)!;

    // Speaker leaves
    h.dispatch(speakerP.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });

    // Session continues with 2 participants
    expect(h.state.participants.size).toBe(2);
    expect(h.phase).toBe("ATTENTION_SELECTION");

    h.teardown();
  });

  test("non-speaker leaves → liveSpeaker unchanged", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(3);

    // Find a non-speaker
    const nonSpeaker = Array.from(h.state.participants.values()).find(
      (p) => p.userId !== speakerUserId,
    )!;

    // Non-speaker leaves
    h.dispatch(nonSpeaker.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });

    // liveSpeaker unchanged
    expect(h.liveSpeaker).toBe(speakerUserId);
    expect(h.phase).toBe("LIVE_SPEAKER");

    h.teardown();
  });
});

// ============================================================================
// 4. LEAVE UPDATES CONSENSUS
// ============================================================================

describe("LEAVE_SESSION Updates Consensus", () => {
  test("LEAVE removes user from consensus count", () => {
    const h = new TestHarness();
    const [alice, bob, carol] = h.addUsers(3);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const bobP = h.getParticipant("Bob")!;
    const carolP = h.getParticipant("Carol")!;

    // All point to Alice
    h.dispatch(aliceP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Alice", targetUserId: aliceP.userId },
    });
    h.dispatch(bobP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Bob", targetUserId: aliceP.userId },
    });
    h.dispatch(carolP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Carol", targetUserId: aliceP.userId },
    });

    // 3/3 consensus
    expect(h.state.pointerMap.size).toBe(3);

    // Carol leaves
    h.dispatch(carolP.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });

    // Now 2/2 consensus (Bob and Alice pointing to Alice)
    expect(h.state.pointerMap.size).toBe(2);

    h.teardown();
  });

  test("LEAVE triggers speaker selection if all pointed to leaver", () => {
    const h = new TestHarness();
    const [alice, bob, carol] = h.addUsers(3);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const bobP = h.getParticipant("Bob")!;
    const carolP = h.getParticipant("Carol")!;

    // Everyone points to Alice
    h.dispatch(aliceP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Alice", targetUserId: aliceP.userId },
    });
    h.dispatch(bobP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Bob", targetUserId: aliceP.userId },
    });
    h.dispatch(carolP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Carol", targetUserId: aliceP.userId },
    });

    // This should trigger speaker selection
    expect(h.liveSpeaker).toBe(aliceP.userId);

    // Alice (the speaker) leaves
    h.dispatch(aliceP.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });

    // liveSpeaker cleared, back to attention selection
    expect(h.liveSpeaker).toBeNull();
    expect(h.phase).toBe("ATTENTION_SELECTION");

    h.teardown();
  });

  test("LEAVE clears pointers TO the leaving user", () => {
    const h = new TestHarness();
    const [alice, bob, carol] = h.addUsers(3);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const bobP = h.getParticipant("Bob")!;
    const carolP = h.getParticipant("Carol")!;

    // Bob and Carol point to Alice
    h.dispatch(bobP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Bob", targetUserId: aliceP.userId },
    });
    h.dispatch(carolP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Carol", targetUserId: aliceP.userId },
    });

    expect(h.state.pointerMap.get(bobP.userId)).toBe(aliceP.userId);
    expect(h.state.pointerMap.get(carolP.userId)).toBe(aliceP.userId);

    // Alice leaves
    h.dispatch(aliceP.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });

    // Pointers TO Alice should be cleared
    expect(h.state.pointerMap.get(bobP.userId)).toBeUndefined();
    expect(h.state.pointerMap.get(carolP.userId)).toBeUndefined();
    expect(h.state.pointerMap.size).toBe(0);

    h.teardown();
  });
});

// ============================================================================
// 5. LEAVE DURING ALL PHASES
// ============================================================================

describe("LEAVE_SESSION During All Phases", () => {
  test("LEAVE during LOBBY phase", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    // Don't start session - stay in LOBBY

    const aliceP = h.getParticipant("Alice")!;

    expect(h.phase).toBe("LOBBY");

    h.dispatch(aliceP.socketId!, { type: ActionTypes.LEAVE_SESSION });

    expect(h.getParticipant("Alice")).toBeUndefined();
    expect(h.phase).toBe("LOBBY"); // Stays in LOBBY with Bob

    h.teardown();
  });

  test("LEAVE during ATTENTION_SELECTION phase", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;

    expect(h.phase).toBe("ATTENTION_SELECTION");

    h.dispatch(aliceP.socketId!, { type: ActionTypes.LEAVE_SESSION });

    expect(h.getParticipant("Alice")).toBeUndefined();
    // Phase stays ATTENTION_SELECTION with Bob

    h.teardown();
  });

  test("LEAVE during LIVE_SPEAKER phase (speaker leaves)", () => {
    const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
    const speakerP = h.getParticipantById(speakerUserId)!;

    expect(h.phase).toBe("LIVE_SPEAKER");

    h.dispatch(speakerP.socketId!, { type: ActionTypes.LEAVE_SESSION });

    // Phase transitions to ATTENTION_SELECTION
    expect(h.phase).toBe("ATTENTION_SELECTION");
    expect(h.liveSpeaker).toBeNull();

    h.teardown();
  });

  test("LEAVE during ENDING phase", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;

    // Force ENDING phase (all users disconnect)
    h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });
    expect(h.phase).toBe("ENDING");

    // Alice reconnects
    h.dispatch("alice-v2", {
      type: ActionTypes.RECONNECT,
      payload: { displayName: "Alice" },
    });
    expect(h.phase).toBe("ATTENTION_SELECTION");

    // Alice leaves
    const aliceReconnected = h.getParticipant("Alice")!;
    h.dispatch(aliceReconnected.socketId!, { type: ActionTypes.LEAVE_SESSION });

    expect(h.getParticipant("Alice")).toBeUndefined();

    h.teardown();
  });
});

// ============================================================================
// 6. MULTI-USER LEAVE SCENARIOS
// ============================================================================

describe("Multi-User LEAVE_SESSION Scenarios", () => {
  test("all users leave → table becomes empty", () => {
    const h = new TestHarness();
    const [alice, bob, carol] = h.addUsers(3);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const bobP = h.getParticipant("Bob")!;
    const carolP = h.getParticipant("Carol")!;

    // All leave one by one
    h.dispatch(aliceP.socketId!, { type: ActionTypes.LEAVE_SESSION });
    expect(h.state.participants.size).toBe(2);

    h.dispatch(bobP.socketId!, { type: ActionTypes.LEAVE_SESSION });
    expect(h.state.participants.size).toBe(1);

    h.dispatch(carolP.socketId!, { type: ActionTypes.LEAVE_SESSION });
    expect(h.state.participants.size).toBe(0);

    h.teardown();
  });

  test("mix of LEAVE and DISCONNECT", () => {
    const h = new TestHarness();
    const [alice, bob, carol] = h.addUsers(3);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const bobP = h.getParticipant("Bob")!;
    const carolP = h.getParticipant("Carol")!;

    // Alice leaves (removed)
    h.dispatch(aliceP.socketId!, { type: ActionTypes.LEAVE_SESSION });

    // Bob disconnects (ghost)
    h.dispatch(bobP.socketId!, { type: ActionTypes.DISCONNECT });

    // Carol still connected
    expect(h.state.participants.size).toBe(2); // Bob ghost + Carol
    expect(h.getParticipant("Alice")).toBeUndefined();
    expect(h.getParticipant("Bob")!.presence).toBe("GHOST");
    expect(h.getParticipant("Carol")!.presence).toBe("CONNECTED");

    h.teardown();
  });

  test("sequential leaves maintain correct participant count", () => {
    const h = new TestHarness();
    const users = h.addUsers(5);
    h.startSession(users[0].userId);

    expect(h.state.participants.size).toBe(5);

    // Leave one by one
    for (let i = 0; i < 5; i++) {
      const p = h.getParticipantById(users[i].userId)!;
      h.dispatch(p.socketId!, { type: ActionTypes.LEAVE_SESSION });
      expect(h.state.participants.size).toBe(4 - i);
    }

    h.teardown();
  });
});

// ============================================================================
// 7. EDGE CASES
// ============================================================================

describe("LEAVE_SESSION Edge Cases", () => {
  test("LEAVE while holding attention pointer", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;

    // Alice points to Bob
    h.dispatch(aliceP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Alice", targetUserId: h.getParticipant("Bob")!.userId },
    });

    expect(h.state.pointerMap.has(aliceP.userId)).toBe(true);

    // Alice leaves
    h.dispatch(aliceP.socketId!, { type: ActionTypes.LEAVE_SESSION });

    // Pointer cleared
    expect(h.state.pointerMap.has(aliceP.userId)).toBe(false);

    h.teardown();
  });

  test("LEAVE while being pointed at", () => {
    const h = new TestHarness();
    const [alice, bob, carol] = h.addUsers(3);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const bobP = h.getParticipant("Bob")!;
    const carolP = h.getParticipant("Carol")!;

    // Bob and Carol point to Alice
    h.dispatch(bobP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Bob", targetUserId: aliceP.userId },
    });
    h.dispatch(carolP.socketId!, {
      type: ActionTypes.POINT_TO_USER,
      payload: { from: "Carol", targetUserId: aliceP.userId },
    });

    // Alice leaves
    h.dispatch(aliceP.socketId!, { type: ActionTypes.LEAVE_SESSION });

    // Pointers TO Alice should be cleared
    expect(h.state.pointerMap.get(bobP.userId)).toBeUndefined();
    expect(h.state.pointerMap.get(carolP.userId)).toBeUndefined();

    h.teardown();
  });

  test("rapid LEAVE calls from same user", () => {
    const h = new TestHarness();
    const [alice, bob] = h.addUsers(2);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;

    // First LEAVE
    h.dispatch(aliceP.socketId!, { type: ActionTypes.LEAVE_SESSION });
    expect(h.getParticipant("Alice")).toBeUndefined();

    // Second LEAVE (should be handled gracefully)
    const effects = h.dispatch(aliceP.socketId!, {
      type: ActionTypes.LEAVE_SESSION,
    });
    expect(effects).toEqual([]); // No effects for non-existent user

    h.teardown();
  });

  test("last participant leaves → phase remains stable", () => {
    const h = new TestHarness();
    const [alice] = h.addUsers(1);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;
    const phaseBefore = h.phase;

    h.dispatch(aliceP.socketId!, { type: ActionTypes.LEAVE_SESSION });

    expect(h.state.participants.size).toBe(0);
    // Phase doesn't change to ENDING (no one left to end session)

    h.teardown();
  });

  test("invariants hold after LEAVE", () => {
    const h = new TestHarness();
    const [alice, bob, carol] = h.addUsers(3);
    h.startSession(alice.userId);

    const aliceP = h.getParticipant("Alice")!;

    h.dispatch(aliceP.socketId!, { type: ActionTypes.LEAVE_SESSION });

    // Invariants:
    // 1. No participant in pointerMap that doesn't exist
    for (const [from, to] of h.state.pointerMap.entries()) {
      expect(h.state.participants.has(from)).toBe(true);
      expect(h.state.participants.has(to)).toBe(true);
    }

    // 2. liveSpeaker exists if set
    if (h.liveSpeaker) {
      expect(h.state.participants.has(h.liveSpeaker)).toBe(true);
    }

    // 3. All CONNECTED participants have valid socketId
    for (const p of h.state.participants.values()) {
      if (p.presence === "CONNECTED") {
        expect(p.socketId).not.toBeNull();
      }
    }

    h.teardown();
  });
});

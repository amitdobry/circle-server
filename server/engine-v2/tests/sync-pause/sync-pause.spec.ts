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

import { describe, test, expect } from "@jest/globals";
import {
  TestHarness,
  createSessionWithUsers,
  createSessionWithActiveSpeaker,
} from "../harness/TestHarness";
import { assertInvariants } from "../../state/invariants";
import * as ActionTypes from "../../actions/actionTypes";

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

function expectActiveSpeakerRoom(
  state: ReturnType<TestHarness["state"]["participants"]["get"]> extends infer P
    ? any
    : any,
  h: TestHarness,
) {
  expect(h.state.liveSpeaker).not.toBeNull();
  expect(h.state.phase).toBe("LIVE_SPEAKER");
  expect(h.state.syncPause).toBe(false);
}

function expectPausedRoom(h: TestHarness) {
  expect(h.state.liveSpeaker).toBeNull();
  expect(h.state.syncPause).toBe(true);
  expect(h.state.phase).not.toBe("LIVE_SPEAKER");
}

function expectNoLiveSpeaker(h: TestHarness) {
  expect(h.state.liveSpeaker).toBeNull();
}

// ============================================================================
// GROUP 1 — BASELINE
// ============================================================================

describe("sync pause behavior", () => {
  describe("baseline", () => {
    test("1. session start does not enter sync pause", () => {
      const { h, users } = createSessionWithUsers(2);

      expect(h.phase).toBe("ATTENTION_SELECTION");
      expect(h.state.syncPause).toBe(false);
      expect(h.liveSpeaker).toBeNull();

      h.teardown();
    });

    test("2. consensus into live speaker clears sync pause", () => {
      const { h, speakerUserId } = createSessionWithActiveSpeaker(2);

      expect(h.phase).toBe("LIVE_SPEAKER");
      expect(h.state.syncPause).toBe(false);
      expect(h.liveSpeaker).toBe(speakerUserId);

      h.teardown();
    });

    test("2b. syncPause is false before any action in LOBBY", () => {
      const h = new TestHarness();
      h.addUsers(2);
      expect(h.state.syncPause).toBe(false);
      h.teardown();
    });
  });

  // ==========================================================================
  // GROUP 2 — MIC HANDOFF
  // ==========================================================================

  describe("mic handoff", () => {
    test("3. DROP_MIC enters paused coordination state", () => {
      const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
      const speakerP = h.getParticipantById(speakerUserId)!;

      h.dropMic(speakerP.socketId!);

      expectPausedRoom(h);
      expect(h.state.phase).toBe("ATTENTION_SELECTION");
      expect(h.state.pointerMap.size).toBe(0);

      expect(() => assertInvariants(h.state)).not.toThrow();
      h.teardown();
    });

    test("4. PASS_MIC enters paused coordination state", () => {
      const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
      const speakerP = h.getParticipantById(speakerUserId)!;

      h.passMic(speakerP.socketId!);

      expectPausedRoom(h);
      expect(h.state.phase).toBe("ATTENTION_SELECTION");
      expect(h.state.pointerMap.size).toBe(0);

      expect(() => assertInvariants(h.state)).not.toThrow();
      h.teardown();
    });

    test("5. ACCEPT_MIC exits paused coordination state", () => {
      const h = new TestHarness();
      const [alice, bob] = h.addUsers(2);
      h.startSession(alice.userId);

      // Simulate post-pass-mic: syncPause=true, no speaker
      const aliceP = h.getParticipant("Alice")!;
      const bobP = h.getParticipant("Bob")!;

      // Drive to live speaker first, then pass mic to create paused state
      h.reachConsensusOn(aliceP.userId);
      expect(h.state.syncPause).toBe(false);
      h.passMic(aliceP.socketId!);
      expect(h.state.syncPause).toBe(true);

      // Bob accepts
      h.dispatch(bobP.socketId!, { type: ActionTypes.ACCEPT_MIC });

      expect(h.phase).toBe("LIVE_SPEAKER");
      expect(h.state.syncPause).toBe(false);
      expect(h.liveSpeaker).toBe(bobP.userId);

      expect(() => assertInvariants(h.state)).not.toThrow();
      h.teardown();
    });

    test("6. DECLINE_MIC does not resume active speaking — syncPause stays consistent", () => {
      const h = new TestHarness();
      const [alice, bob] = h.addUsers(2);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;
      const bobP = h.getParticipant("Bob")!;

      h.reachConsensusOn(aliceP.userId);
      h.dropMic(aliceP.socketId!);

      // Paused state established
      expect(h.state.syncPause).toBe(true);
      expect(h.liveSpeaker).toBeNull();

      // Bob declines mic
      h.dispatch(bobP.socketId!, { type: ActionTypes.DECLINE_MIC });

      // Room must NOT jump to LIVE_SPEAKER
      expect(h.phase).not.toBe("LIVE_SPEAKER");
      expect(h.liveSpeaker).toBeNull();

      expect(() => assertInvariants(h.state)).not.toThrow();
      h.teardown();
    });
  });

  // ==========================================================================
  // GROUP 3 — CONSENSUS RESET
  // ==========================================================================

  describe("consensus reset", () => {
    test("7. breaking consensus via re-point → ATTENTION_SELECTION, syncPause=false (not a handoff)", () => {
      const h = new TestHarness();
      const [alice, bob, carol] = h.addUsers(3);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;
      const carolP = h.getParticipant("Carol")!;
      const bobP = h.getParticipant("Bob")!;

      h.reachConsensusOn(aliceP.userId);
      expect(h.phase).toBe("LIVE_SPEAKER");

      // Carol re-points to Bob — breaks consensus
      h.dispatch(carolP.socketId!, {
        type: ActionTypes.POINT_TO_USER,
        payload: { from: "Carol", targetUserId: "Bob" },
      });

      // Contract: broken consensus = plain attention selection, no handoff pause
      expect(h.phase).toBe("ATTENTION_SELECTION");
      expect(h.liveSpeaker).toBeNull();
      expect(h.state.syncPause).toBe(false); // NOT a mic handoff — no pause

      expect(() => assertInvariants(h.state)).not.toThrow();
      h.teardown();
    });
  });

  // ==========================================================================
  // GROUP 4 — DISCONNECT EDGE CASES
  // ==========================================================================

  describe("disconnect", () => {
    test("8. speaker disconnect — mic drops immediately (speaker invalidation)", () => {
      const { h, speakerUserId } = createSessionWithActiveSpeaker(3);
      const speakerP = h.getParticipantById(speakerUserId)!;

      h.dispatch(speakerP.socketId!, { type: ActionTypes.DISCONNECT });

      // ✅ NEW BEHAVIOR: Mic drops immediately when speaker disconnects
      expect(h.liveSpeaker).toBeNull();
      expect(h.phase).toBe("ATTENTION_SELECTION");
      expect(h.state.syncPause).toBe(false);

      // No contradiction: ATTENTION_SELECTION + syncPause=false is valid
      expect(() => assertInvariants(h.state)).not.toThrow();
      h.teardown();
    });

    test("9. last user disconnects — phase ENDING, syncPause=false (not a coordination state)", () => {
      const h = new TestHarness();
      const [alice] = h.addUsers(1);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;
      h.dispatch(aliceP.socketId!, { type: ActionTypes.DISCONNECT });

      expect(h.phase).toBe("ENDING");
      expect(h.state.syncPause).toBe(false);

      expect(() => assertInvariants(h.state)).not.toThrow();
      h.teardown();
    });

    test("9b. last user disconnects after live speaker was set — liveSpeaker cleared in ENDING", () => {
      const { h, speakerUserId, users } = createSessionWithActiveSpeaker(2);

      // Disconnect both users
      for (const user of users) {
        const p = h.getParticipant(user.displayName);
        if (p?.presence === "CONNECTED") {
          h.dispatch(p.socketId!, { type: ActionTypes.DISCONNECT });
        }
      }

      expect(h.phase).toBe("ENDING");
      expect(h.liveSpeaker).toBeNull();
      expect(h.state.syncPause).toBe(false);

      expect(() => assertInvariants(h.state)).not.toThrow();
      h.teardown();
    });
  });

  // ==========================================================================
  // GROUP 5 — REGRESSION GUARDS
  // ==========================================================================

  describe("regressions", () => {
    test("10. [regression] drop mic always clears liveSpeaker AND sets syncPause", () => {
      const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
      const speakerP = h.getParticipantById(speakerUserId)!;

      h.dropMic(speakerP.socketId!);

      // Both must be set — not just a role reset
      expect(h.liveSpeaker).toBeNull();
      expect(h.state.syncPause).toBe(true);

      h.teardown();
    });

    test("11. [regression] pass mic always clears liveSpeaker AND sets syncPause", () => {
      const { h, speakerUserId } = createSessionWithActiveSpeaker(2);
      const speakerP = h.getParticipantById(speakerUserId)!;

      h.passMic(speakerP.socketId!);

      expect(h.liveSpeaker).toBeNull();
      expect(h.state.syncPause).toBe(true);

      h.teardown();
    });

    test("12. [regression] accept mic always clears syncPause", () => {
      const h = new TestHarness();
      const [alice, bob] = h.addUsers(2);
      h.startSession(alice.userId);

      const aliceP = h.getParticipant("Alice")!;
      const bobP = h.getParticipant("Bob")!;

      h.reachConsensusOn(aliceP.userId);
      h.dropMic(aliceP.socketId!);

      // Verify paused state before accept
      expect(h.state.syncPause).toBe(true);

      h.dispatch(bobP.socketId!, { type: ActionTypes.ACCEPT_MIC });

      // Must be false — paused flag must not survive into active speaker state
      expect(h.state.syncPause).toBe(false);
      expect(h.phase).toBe("LIVE_SPEAKER");

      h.teardown();
    });

    test("13. [regression] LIVE_SPEAKER phase and syncPause=true never co-exist", () => {
      // After any sequence that ends in LIVE_SPEAKER, syncPause must be false
      const { h, speakerUserId } = createSessionWithActiveSpeaker(3);

      expect(h.phase).toBe("LIVE_SPEAKER");
      expect(h.state.syncPause).toBe(false);

      expect(() => assertInvariants(h.state)).not.toThrow();
      h.teardown();
    });
  });
});

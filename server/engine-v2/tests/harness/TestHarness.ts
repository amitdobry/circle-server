/**
 * Engine V2: Test Harness
 *
 * Central testing utility for all Engine V2 specs.
 * Creates isolated rooms, provides dispatch helpers, and records effects.
 *
 * Usage:
 *   const h = new TestHarness();
 *   const alice = h.addUser("alice", "avatar-panda");
 *   h.startSession(alice.userId);
 *   // ...
 *   h.teardown();
 */

import { roomRegistry } from "../../registry/RoomRegistry";
import { dispatch } from "../../reducer/dispatch";
import { assertInvariants } from "../../state/invariants";
import * as ActionTypes from "../../actions/actionTypes";
import type { TableState, Effect, ParticipantState } from "../../state/types";

// ============================================================================
// TYPES
// ============================================================================

export interface TestUser {
  userId: string;    // socketId used as userId in tests
  displayName: string;
  avatarId: string;
}

export interface DispatchResult {
  effects: Effect[];
  state: TableState;
}

// ============================================================================
// TEST HARNESS CLASS
// ============================================================================

export class TestHarness {
  readonly roomId: string;
  private userCounter = 0;
  readonly state: TableState;

  // All effects collected since last reset
  private _effects: Effect[] = [];

  constructor(roomId?: string) {
    this.roomId = roomId ?? `test-room-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.state = roomRegistry.createRoom(this.roomId);
  }

  // ==========================================================================
  // USER HELPERS
  // ==========================================================================

  /**
   * Create a test user object (does NOT dispatch JOIN_SESSION).
   * Use addUser() to also join the room.
   */
  makeUser(displayName: string, avatarId?: string): TestUser {
    this.userCounter++;
    return {
      userId: `socket-${displayName.toLowerCase()}-${this.userCounter}`,
      displayName,
      avatarId: avatarId ?? `avatar-${this.userCounter}`,
    };
  }

  /**
   * Create a user AND dispatch JOIN_SESSION for them.
   * Returns the TestUser with the socketId used.
   */
  addUser(displayName: string, avatarId?: string): TestUser {
    const user = this.makeUser(displayName, avatarId);
    this.dispatch(user.userId, {
      type: ActionTypes.JOIN_SESSION,
      payload: {
        displayName: user.displayName,
        avatarId: user.avatarId,
        socketId: user.userId,
      },
    });
    return user;
  }

  /**
   * Add N users at once. Returns array of TestUser.
   */
  addUsers(count: number): TestUser[] {
    const names = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Henry"];
    return Array.from({ length: count }, (_, i) =>
      this.addUser(names[i] ?? `User${i + 1}`)
    );
  }

  // ==========================================================================
  // DISPATCH HELPERS
  // ==========================================================================

  /**
   * Dispatch an action and record effects. Throws if invariants fail.
   */
  dispatch(userId: string | null, action: { type: string; payload?: any }): Effect[] {
    const effects = dispatch(this.roomId, userId, action as any);
    this._effects.push(...effects);
    return effects;
  }

  /**
   * Get all effects since last reset.
   */
  get effects(): Effect[] {
    return [...this._effects];
  }

  /**
   * Clear collected effects (useful between phases in a test).
   */
  clearEffects(): void {
    this._effects = [];
  }

  // ==========================================================================
  // SCENARIO SHORTCUTS
  // ==========================================================================

  /**
   * Start the session (LOBBY → ATTENTION_SELECTION).
   */
  startSession(userId: string, durationMinutes = 60): Effect[] {
    return this.dispatch(userId, {
      type: ActionTypes.CLICK_READY_TO_GLOW,
      payload: { durationMinutes },
    });
  }

  /**
   * Have all users in the room point to a target userId.
   * Used to drive consensus.
   */
  allPointTo(targetUserId: string, excludeUserId?: string): void {
    for (const [uid, participant] of this.state.participants) {
      if (participant.presence !== "CONNECTED") continue;
      if (excludeUserId && uid === excludeUserId) continue;
      this.dispatch(participant.socketId!, {
        type: ActionTypes.POINT_TO_USER,
        payload: {
          from: participant.displayName,
          targetUserId: this.state.participants.get(targetUserId)?.displayName,
        },
      });
    }
  }

  /**
   * Drive consensus to a specific user (all connected users point to target).
   * Returns the effects from the final pointer that triggers consensus.
   */
  reachConsensusOn(targetUserId: string): Effect[] {
    this.clearEffects();
    this.allPointTo(targetUserId);
    return this.effects;
  }

  /**
   * Drop the mic (speaker → ATTENTION_SELECTION).
   */
  dropMic(userId: string): Effect[] {
    return this.dispatch(userId, { type: ActionTypes.DROP_MIC });
  }

  /**
   * Pass the mic (speaker → ATTENTION_SELECTION).
   */
  passMic(userId: string): Effect[] {
    return this.dispatch(userId, { type: ActionTypes.PASS_MIC });
  }

  /**
   * Disconnect a user (CONNECTED → GHOST).
   */
  disconnect(userId: string): Effect[] {
    const participant = this.state.participants.get(userId);
    const socketId = participant?.socketId;
    return this.dispatch(socketId ?? userId, { type: ActionTypes.DISCONNECT });
  }

  /**
   * Reconnect a user (GHOST → CONNECTED) with a new socketId.
   */
  reconnect(user: TestUser, newSocketId?: string): TestUser {
    const newId = newSocketId ?? `${user.userId}-reconnected`;
    this.dispatch(newId, {
      type: ActionTypes.RECONNECT,
      payload: { displayName: user.displayName },
    });
    // Return updated user reference
    return { ...user, userId: newId };
  }

  /**
   * Leave the session (removes participant).
   */
  leave(user: TestUser): Effect[] {
    return this.dispatch(user.userId, {
      type: ActionTypes.LEAVE_SESSION,
      payload: { displayName: user.displayName },
    });
  }

  /**
   * Fire timer expiry.
   */
  expireTimer(): Effect[] {
    return this.dispatch(null, { type: ActionTypes.TIMER_EXPIRED });
  }

  /**
   * End the session.
   */
  endSession(): Effect[] {
    return this.dispatch(null, { type: ActionTypes.END_SESSION });
  }

  // ==========================================================================
  // STATE QUERIES
  // ==========================================================================

  /**
   * Get the current session phase.
   */
  get phase(): string {
    return this.state.phase;
  }

  /**
   * Get the live speaker userId (or null).
   */
  get liveSpeaker(): string | null {
    return this.state.liveSpeaker;
  }

  /**
   * Get the live speaker's display name (or null).
   */
  get liveSpeakerName(): string | null {
    if (!this.state.liveSpeaker) return null;
    return this.state.participants.get(this.state.liveSpeaker)?.displayName ?? null;
  }

  /**
   * Get connected participants (excluding ghosts).
   */
  get connectedUsers(): ParticipantState[] {
    return Array.from(this.state.participants.values()).filter(
      (p) => p.presence === "CONNECTED"
    );
  }

  /**
   * Get participant by display name.
   */
  getParticipant(displayName: string): ParticipantState | undefined {
    for (const p of this.state.participants.values()) {
      if (p.displayName === displayName) return p;
    }
    return undefined;
  }

  /**
   * Get participant by userId.
   */
  getParticipantById(userId: string): ParticipantState | undefined {
    return this.state.participants.get(userId);
  }

  /**
   * Get all emitted socket events from collected effects.
   */
  getEmittedEvents(): Array<{ event: string; data: any }> {
    return this._effects
      .filter((e): e is Extract<Effect, { type: "SOCKET_EMIT_ROOM" | "SOCKET_EMIT_USER" }> =>
        e.type === "SOCKET_EMIT_ROOM" || e.type === "SOCKET_EMIT_USER"
      )
      .map((e) => ({ event: e.event, data: e.data }));
  }

  /**
   * Get all SOCKET_EMIT_ROOM events.
   */
  getRoomEmits(): Array<{ event: string; data: any }> {
    return this._effects
      .filter((e): e is Extract<Effect, { type: "SOCKET_EMIT_ROOM" }> =>
        e.type === "SOCKET_EMIT_ROOM"
      )
      .map((e) => ({ event: e.event, data: e.data }));
  }

  /**
   * Check whether an event was emitted (by event name).
   */
  wasEmitted(eventName: string): boolean {
    return this.getEmittedEvents().some((e) => e.event === eventName);
  }

  /**
   * Get the data from the last emit of a given event.
   */
  lastEmit(eventName: string): any | undefined {
    const all = this.getEmittedEvents().filter((e) => e.event === eventName);
    return all[all.length - 1]?.data;
  }

  // ==========================================================================
  // INVARIANT HELPERS
  // ==========================================================================

  /**
   * Assert all invariants hold on current state.
   * Throws InvariantViolation if any fail.
   */
  assertInvariants(): void {
    assertInvariants(this.state);
  }

  // ==========================================================================
  // TEARDOWN
  // ==========================================================================

  /**
   * Clean up: destroy the room from registry.
   * Call in afterEach().
   */
  teardown(): void {
    roomRegistry.destroyRoom(this.roomId);
  }
}

// ============================================================================
// CONVENIENCE FACTORY
// ============================================================================

/**
 * Create a harness that is already at ATTENTION_SELECTION phase with N users.
 * The first user triggers the session start.
 */
export function createSessionWithUsers(count: number): {
  h: TestHarness;
  users: TestUser[];
} {
  const h = new TestHarness();
  const users = h.addUsers(count);
  h.startSession(users[0].userId);
  return { h, users };
}

/**
 * Create a harness at LIVE_SPEAKER phase with the first user as speaker.
 * Requires at least 2 users for consensus by default. For 1 user,
 * the single user must point to themselves.
 */
export function createSessionWithActiveSpeaker(count = 2): {
  h: TestHarness;
  users: TestUser[];
  speakerUserId: string;
} {
  const { h, users } = createSessionWithUsers(count);
  // All users point to first user to reach consensus
  const target = users[0];
  // Find userId from state
  const targetParticipant = h.getParticipant(target.displayName)!;
  h.reachConsensusOn(targetParticipant.userId);
  return { h, users, speakerUserId: targetParticipant.userId };
}

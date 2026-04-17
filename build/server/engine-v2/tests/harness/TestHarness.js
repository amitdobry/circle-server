"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestHarness = void 0;
exports.createSessionWithUsers = createSessionWithUsers;
exports.createSessionWithActiveSpeaker = createSessionWithActiveSpeaker;
const RoomRegistry_1 = require("../../registry/RoomRegistry");
const dispatch_1 = require("../../reducer/dispatch");
const invariants_1 = require("../../state/invariants");
const ActionTypes = __importStar(require("../../actions/actionTypes"));
// ============================================================================
// TEST HARNESS CLASS
// ============================================================================
class TestHarness {
    constructor(roomId) {
        this.userCounter = 0;
        // All effects collected since last reset
        this._effects = [];
        this.roomId = roomId ?? `test-room-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        this.state = RoomRegistry_1.roomRegistry.createRoom(this.roomId);
    }
    // ==========================================================================
    // USER HELPERS
    // ==========================================================================
    /**
     * Create a test user object (does NOT dispatch JOIN_SESSION).
     * Use addUser() to also join the room.
     */
    makeUser(displayName, avatarId) {
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
    addUser(displayName, avatarId) {
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
    addUsers(count) {
        const names = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Henry"];
        return Array.from({ length: count }, (_, i) => this.addUser(names[i] ?? `User${i + 1}`));
    }
    // ==========================================================================
    // DISPATCH HELPERS
    // ==========================================================================
    /**
     * Dispatch an action and record effects. Throws if invariants fail.
     */
    dispatch(userId, action) {
        const effects = (0, dispatch_1.dispatch)(this.roomId, userId, action);
        this._effects.push(...effects);
        return effects;
    }
    /**
     * Get all effects since last reset.
     */
    get effects() {
        return [...this._effects];
    }
    /**
     * Clear collected effects (useful between phases in a test).
     */
    clearEffects() {
        this._effects = [];
    }
    // ==========================================================================
    // SCENARIO SHORTCUTS
    // ==========================================================================
    /**
     * Start the session (LOBBY → ATTENTION_SELECTION).
     */
    startSession(userId, durationMinutes = 60) {
        return this.dispatch(userId, {
            type: ActionTypes.CLICK_READY_TO_GLOW,
            payload: { durationMinutes },
        });
    }
    /**
     * Have all users in the room point to a target userId.
     * Used to drive consensus.
     */
    allPointTo(targetUserId, excludeUserId) {
        for (const [uid, participant] of this.state.participants) {
            if (participant.presence !== "CONNECTED")
                continue;
            if (excludeUserId && uid === excludeUserId)
                continue;
            this.dispatch(participant.socketId, {
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
    reachConsensusOn(targetUserId) {
        this.clearEffects();
        this.allPointTo(targetUserId);
        return this.effects;
    }
    /**
     * Drop the mic (speaker → ATTENTION_SELECTION).
     */
    dropMic(userId) {
        return this.dispatch(userId, { type: ActionTypes.DROP_MIC });
    }
    /**
     * Pass the mic (speaker → ATTENTION_SELECTION).
     */
    passMic(userId) {
        return this.dispatch(userId, { type: ActionTypes.PASS_MIC });
    }
    /**
     * Disconnect a user (CONNECTED → GHOST).
     */
    disconnect(userId) {
        const participant = this.state.participants.get(userId);
        const socketId = participant?.socketId;
        return this.dispatch(socketId ?? userId, { type: ActionTypes.DISCONNECT });
    }
    /**
     * Reconnect a user (GHOST → CONNECTED) with a new socketId.
     */
    reconnect(user, newSocketId) {
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
    leave(user) {
        return this.dispatch(user.userId, {
            type: ActionTypes.LEAVE_SESSION,
            payload: { displayName: user.displayName },
        });
    }
    /**
     * Fire timer expiry.
     */
    expireTimer() {
        return this.dispatch(null, { type: ActionTypes.TIMER_EXPIRED });
    }
    /**
     * End the session.
     */
    endSession() {
        return this.dispatch(null, { type: ActionTypes.END_SESSION });
    }
    // ==========================================================================
    // STATE QUERIES
    // ==========================================================================
    /**
     * Get the current session phase.
     */
    get phase() {
        return this.state.phase;
    }
    /**
     * Get the live speaker userId (or null).
     */
    get liveSpeaker() {
        return this.state.liveSpeaker;
    }
    /**
     * Get the live speaker's display name (or null).
     */
    get liveSpeakerName() {
        if (!this.state.liveSpeaker)
            return null;
        return this.state.participants.get(this.state.liveSpeaker)?.displayName ?? null;
    }
    /**
     * Get connected participants (excluding ghosts).
     */
    get connectedUsers() {
        return Array.from(this.state.participants.values()).filter((p) => p.presence === "CONNECTED");
    }
    /**
     * Get participant by display name.
     */
    getParticipant(displayName) {
        for (const p of this.state.participants.values()) {
            if (p.displayName === displayName)
                return p;
        }
        return undefined;
    }
    /**
     * Get participant by userId.
     */
    getParticipantById(userId) {
        return this.state.participants.get(userId);
    }
    /**
     * Get all emitted socket events from collected effects.
     */
    getEmittedEvents() {
        return this._effects
            .filter((e) => e.type === "SOCKET_EMIT_ROOM" || e.type === "SOCKET_EMIT_USER")
            .map((e) => ({ event: e.event, data: e.data }));
    }
    /**
     * Get all SOCKET_EMIT_ROOM events.
     */
    getRoomEmits() {
        return this._effects
            .filter((e) => e.type === "SOCKET_EMIT_ROOM")
            .map((e) => ({ event: e.event, data: e.data }));
    }
    /**
     * Check whether an event was emitted (by event name).
     */
    wasEmitted(eventName) {
        return this.getEmittedEvents().some((e) => e.event === eventName);
    }
    /**
     * Get the data from the last emit of a given event.
     */
    lastEmit(eventName) {
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
    assertInvariants() {
        (0, invariants_1.assertInvariants)(this.state);
    }
    // ==========================================================================
    // TEARDOWN
    // ==========================================================================
    /**
     * Clean up: destroy the room from registry.
     * Call in afterEach().
     */
    teardown() {
        RoomRegistry_1.roomRegistry.destroyRoom(this.roomId);
    }
}
exports.TestHarness = TestHarness;
// ============================================================================
// CONVENIENCE FACTORY
// ============================================================================
/**
 * Create a harness that is already at ATTENTION_SELECTION phase with N users.
 * The first user triggers the session start.
 */
function createSessionWithUsers(count) {
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
function createSessionWithActiveSpeaker(count = 2) {
    const { h, users } = createSessionWithUsers(count);
    // All users point to first user to reach consensus
    const target = users[0];
    // Find userId from state
    const targetParticipant = h.getParticipant(target.displayName);
    h.reachConsensusOn(targetParticipant.userId);
    return { h, users, speakerUserId: targetParticipant.userId };
}

"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const TestHarness_1 = require("../harness/TestHarness");
(0, globals_1.describe)("Session Lifecycle", () => {
    let h;
    (0, globals_1.afterEach)(() => {
        h.teardown();
    });
    // ==========================================================================
    // JOIN
    // ==========================================================================
    (0, globals_1.describe)("JOIN_SESSION", () => {
        (0, globals_1.beforeEach)(() => {
            h = new TestHarness_1.TestHarness();
        });
        (0, globals_1.test)("first user joins → participant added, phase stays LOBBY", () => {
            const alice = h.addUser("Alice");
            (0, globals_1.expect)(h.state.participants.size).toBe(1);
            (0, globals_1.expect)(h.phase).toBe("LOBBY");
            const p = h.getParticipant("Alice");
            (0, globals_1.expect)(p).toBeDefined();
            (0, globals_1.expect)(p.displayName).toBe("Alice");
            (0, globals_1.expect)(p.presence).toBe("CONNECTED");
            (0, globals_1.expect)(p.role).toBe("listener");
        });
        (0, globals_1.test)("multiple users join → all added", () => {
            h.addUser("Alice");
            h.addUser("Bob");
            h.addUser("Carol");
            (0, globals_1.expect)(h.state.participants.size).toBe(3);
            (0, globals_1.expect)(h.connectedUsers.length).toBe(3);
        });
        (0, globals_1.test)("avatar conflict is rejected when avatar already taken by CONNECTED user", () => {
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
            (0, globals_1.expect)(h.state.participants.size).toBe(1);
            // A join-rejected event should be emitted
            (0, globals_1.expect)(h.wasEmitted("join-rejected")).toBe(true);
        });
        (0, globals_1.test)("same user joins twice → presence updated to CONNECTED (reconnect path)", () => {
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
            (0, globals_1.expect)(h.state.participants.size).toBe(1);
            (0, globals_1.expect)(h.getParticipant("Alice").presence).toBe("CONNECTED");
        });
        (0, globals_1.test)("join emits v2:user-joined event", () => {
            h.addUser("Alice");
            (0, globals_1.expect)(h.wasEmitted("v2:user-joined")).toBe(true);
        });
    });
    // ==========================================================================
    // SESSION START
    // ==========================================================================
    (0, globals_1.describe)("CLICK_READY_TO_GLOW (session start)", () => {
        (0, globals_1.beforeEach)(() => {
            h = new TestHarness_1.TestHarness();
        });
        (0, globals_1.test)("valid start → phase transitions LOBBY → ATTENTION_SELECTION", () => {
            const alice = h.addUser("Alice");
            h.startSession(alice.userId);
            (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION");
        });
        (0, globals_1.test)("timer is activated on session start", () => {
            const alice = h.addUser("Alice");
            h.startSession(alice.userId, 30);
            (0, globals_1.expect)(h.state.timer.active).toBe(true);
            (0, globals_1.expect)(h.state.timer.durationMs).toBe(30 * 60 * 1000);
        });
        (0, globals_1.test)("start emits v2:session-started event", () => {
            const alice = h.addUser("Alice");
            h.clearEffects();
            h.startSession(alice.userId);
            (0, globals_1.expect)(h.wasEmitted("v2:session-started")).toBe(true);
        });
        (0, globals_1.test)("start from wrong phase is ignored", () => {
            const alice = h.addUser("Alice");
            h.startSession(alice.userId); // LOBBY → ATTENTION_SELECTION
            h.clearEffects();
            const effects = h.startSession(alice.userId); // already in ATTENTION_SELECTION
            (0, globals_1.expect)(h.phase).toBe("ATTENTION_SELECTION"); // no change
            (0, globals_1.expect)(effects.length).toBe(0);
        });
        (0, globals_1.test)("unknown userId cannot start session", () => {
            const effects = h.dispatch("ghost-socket", {
                type: "CLICK_READY_TO_GLOW",
                payload: { durationMinutes: 60 },
            });
            (0, globals_1.expect)(h.phase).toBe("LOBBY");
        });
    });
    // ==========================================================================
    // LEAVE
    // ==========================================================================
    (0, globals_1.describe)("LEAVE_SESSION", () => {
        (0, globals_1.beforeEach)(() => {
            h = new TestHarness_1.TestHarness();
        });
        (0, globals_1.test)("user leaves → removed from participants", () => {
            const alice = h.addUser("Alice");
            const bob = h.addUser("Bob");
            h.leave(alice);
            (0, globals_1.expect)(h.state.participants.has(h.getParticipant("Alice")?.userId ?? "")).toBe(false);
            (0, globals_1.expect)(h.state.participants.size).toBe(1);
        });
        (0, globals_1.test)("speaker leaves → liveSpeaker cleared, phase drops to ATTENTION_SELECTION", () => {
            // Set up a live-speaker scenario in a fresh nested harness
            const h2 = new TestHarness_1.TestHarness();
            const [alice, bob] = h2.addUsers(2);
            h2.startSession(alice.userId);
            const aliceP = h2.getParticipant(alice.displayName);
            h2.reachConsensusOn(aliceP.userId);
            (0, globals_1.expect)(h2.phase).toBe("LIVE_SPEAKER");
            (0, globals_1.expect)(h2.liveSpeaker).toBe(aliceP.userId);
            // Alice leaves
            h2.leave(alice);
            (0, globals_1.expect)(h2.liveSpeaker).toBeNull();
            (0, globals_1.expect)(h2.phase).toBe("ATTENTION_SELECTION");
            h2.teardown();
        });
    });
    // ==========================================================================
    // TIMER EXPIRY
    // ==========================================================================
    (0, globals_1.describe)("TIMER_EXPIRED → END_SESSION", () => {
        (0, globals_1.beforeEach)(() => {
            h = new TestHarness_1.TestHarness();
        });
        (0, globals_1.test)("timer expires → phase becomes ENDING", () => {
            const alice = h.addUser("Alice");
            h.startSession(alice.userId);
            h.expireTimer();
            (0, globals_1.expect)(h.phase).toBe("ENDING");
            (0, globals_1.expect)(h.state.timer.active).toBe(false);
        });
        (0, globals_1.test)("timer expiry emits v2:session-ending", () => {
            const alice = h.addUser("Alice");
            h.startSession(alice.userId);
            h.clearEffects();
            h.expireTimer();
            (0, globals_1.expect)(h.wasEmitted("v2:session-ending")).toBe(true);
        });
        (0, globals_1.test)("END_SESSION → phase becomes ENDED", () => {
            const alice = h.addUser("Alice");
            h.startSession(alice.userId);
            h.expireTimer();
            h.endSession();
            (0, globals_1.expect)(h.phase).toBe("ENDED");
            (0, globals_1.expect)(h.liveSpeaker).toBeNull();
        });
        (0, globals_1.test)("END_SESSION emits v2:session-ended", () => {
            const alice = h.addUser("Alice");
            h.startSession(alice.userId);
            h.expireTimer();
            h.clearEffects();
            h.endSession();
            (0, globals_1.expect)(h.wasEmitted("v2:session-ended")).toBe(true);
        });
        (0, globals_1.test)("timer expiry schedules delayed END_SESSION action", () => {
            const alice = h.addUser("Alice");
            h.startSession(alice.userId);
            h.clearEffects();
            h.expireTimer();
            const delayed = h.effects.find((e) => e.type === "DELAYED_ACTION");
            (0, globals_1.expect)(delayed).toBeDefined();
            (0, globals_1.expect)(delayed.action.type).toBe("END_SESSION");
            (0, globals_1.expect)(delayed.delayMs).toBe(30000);
        });
    });
});

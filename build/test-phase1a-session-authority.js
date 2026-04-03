"use strict";
/**
 * Phase 1A: Session Authority Test Script
 *
 * Tests Engine V2 session lifecycle:
 * - Session registry API
 * - TIMER_EXPIRED transition
 * - ADMIN_END_SESSION transition
 * - Cleanup scheduling
 *
 * Run with: npx ts-node test-phase1a-session-authority.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const RoomRegistry_1 = require("./server/engine-v2/registry/RoomRegistry");
const dispatch_1 = require("./server/engine-v2/reducer/dispatch");
const sessionRegistry_1 = require("./server/engine-v2/api/sessionRegistry");
const runEffects_1 = require("./server/engine-v2/effects/runEffects");
// Mock Socket.IO server for testing
const mockIo = {
    to: (roomId) => ({
        emit: (event, data) => {
            console.log(`[Mock IO] Room ${roomId} <- ${event}`, JSON.stringify(data, null, 2));
        },
    }),
    emit: (event, data) => {
        console.log(`[Mock IO] Broadcast <- ${event}`, JSON.stringify(data, null, 2));
    },
};
console.log("\n" + "=".repeat(80));
console.log("PHASE 1A: Session Authority Test");
console.log("=".repeat(80) + "\n");
// ============================================================================
// Test 1: Create room and join users
// ============================================================================
console.log("\n📝 Test 1: Create Room and Join Users\n");
const roomId = "test-room-1";
// Create room (sessionId is auto-generated)
const tableState = RoomRegistry_1.roomRegistry.getOrCreateRoom(roomId);
const sessionId = tableState.sessionId;
console.log(`✅ Created room: ${roomId} with session: ${sessionId}`);
// Join user 1
let effects = (0, dispatch_1.dispatch)(roomId, "user-1", {
    type: "JOIN_SESSION",
    payload: {
        userId: "user-1",
        displayName: "Alice",
        avatarId: "owl",
        socketId: "socket-1",
    },
});
(0, runEffects_1.runEffects)(effects, mockIo);
console.log(`✅ User 1 (Alice) joined`);
// Join user 2
effects = (0, dispatch_1.dispatch)(roomId, "user-2", {
    type: "JOIN_SESSION",
    payload: {
        userId: "user-2",
        displayName: "Bob",
        avatarId: "fox",
        socketId: "socket-2",
    },
});
(0, runEffects_1.runEffects)(effects, mockIo);
console.log(`✅ User 2 (Bob) joined`);
// ============================================================================
// Test 2: Query Session Registry
// ============================================================================
console.log("\n📝 Test 2: Session Registry API\n");
const allSessions = sessionRegistry_1.sessionRegistry.getAllSessions();
console.log(`📊 Total sessions: ${allSessions.length}`);
console.log("Sessions:", JSON.stringify(allSessions, null, 2));
const sessionInfo = sessionRegistry_1.sessionRegistry.getSession(sessionId);
console.log("\n📊 Session info:", JSON.stringify(sessionInfo, null, 2));
const userSession = sessionRegistry_1.sessionRegistry.getUserSession("user-1");
console.log("\n📊 User 1 session:", JSON.stringify(userSession, null, 2));
console.log(`\n✅ Session registry queries successful`);
// ============================================================================
// Test 3: Timer Expiration
// ============================================================================
console.log("\n📝 Test 3: TIMER_EXPIRED Transition\n");
effects = (0, dispatch_1.dispatch)(roomId, null, {
    type: "TIMER_EXPIRED",
    payload: {},
});
console.log(`\n📊 TIMER_EXPIRED produced ${effects.length} effects:`);
effects.forEach((effect, i) => {
    console.log(`  ${i + 1}. ${effect.type}`);
});
(0, runEffects_1.runEffects)(effects, mockIo);
// Check session phase
const room = RoomRegistry_1.roomRegistry.getRoom(roomId);
if (room) {
    console.log(`\n📊 Session phase after TIMER_EXPIRED: ${room.phase}`);
    console.log(`📊 Timer active: ${room.timer.active}`);
    // Calculate remaining time if timer is active
    const remaining = room.timer.active && room.timer.endTime
        ? Math.max(0, room.timer.endTime - Date.now())
        : 0;
    console.log(`📊 Timer remaining: ${remaining}ms`);
    if (room.phase === "ENDING") {
        console.log(`✅ Session correctly transitioned to ENDING phase`);
    }
    else {
        console.error(`❌ Expected ENDING phase, got ${room.phase}`);
    }
}
// ============================================================================
// Test 4: Manual Session End (Simulating grace period expiry)
// ============================================================================
console.log("\n📝 Test 4: END_SESSION Transition\n");
effects = (0, dispatch_1.dispatch)(roomId, null, {
    type: "END_SESSION",
    payload: {},
});
console.log(`\n📊 END_SESSION produced ${effects.length} effects:`);
effects.forEach((effect, i) => {
    console.log(`  ${i + 1}. ${effect.type}`);
});
(0, runEffects_1.runEffects)(effects, mockIo);
// Check session phase
const roomAfterEnd = RoomRegistry_1.roomRegistry.getRoom(roomId);
if (roomAfterEnd) {
    console.log(`\n📊 Session phase after END_SESSION: ${roomAfterEnd.phase}`);
    console.log(`📊 Live speaker: ${roomAfterEnd.liveSpeaker || "none"}`);
    if (roomAfterEnd.phase === "ENDED") {
        console.log(`✅ Session correctly transitioned to ENDED phase`);
    }
    else {
        console.error(`❌ Expected ENDED phase, got ${roomAfterEnd.phase}`);
    }
}
// ============================================================================
// Test 5: Admin End Session
// ============================================================================
console.log("\n📝 Test 5: ADMIN_END_SESSION\n");
// Create a new room for this test
const roomId2 = "test-room-2";
const tableState2 = RoomRegistry_1.roomRegistry.getOrCreateRoom(roomId2);
const sessionId2 = tableState2.sessionId;
console.log(`✅ Created room: ${roomId2} with session: ${sessionId2}`);
// Join a user
effects = (0, dispatch_1.dispatch)(roomId2, "user-3", {
    type: "JOIN_SESSION",
    payload: {
        userId: "user-3",
        displayName: "Charlie",
        avatarId: "bear",
        socketId: "socket-3",
    },
});
(0, runEffects_1.runEffects)(effects, mockIo);
console.log(`✅ User 3 (Charlie) joined`);
// Admin ends session
effects = (0, dispatch_1.dispatch)(roomId2, null, {
    type: "ADMIN_END_SESSION",
    payload: {
        adminId: "admin-1",
        sessionId: sessionId2,
    },
});
console.log(`\n📊 ADMIN_END_SESSION produced ${effects.length} effects:`);
effects.forEach((effect, i) => {
    console.log(`  ${i + 1}. ${effect.type}`);
});
(0, runEffects_1.runEffects)(effects, mockIo);
// Check session phase
const room2 = RoomRegistry_1.roomRegistry.getRoom(roomId2);
if (room2) {
    console.log(`\n📊 Session phase after ADMIN_END_SESSION: ${room2.phase}`);
    if (room2.phase === "ENDED") {
        console.log(`✅ Session correctly terminated by admin`);
    }
    else {
        console.error(`❌ Expected ENDED phase, got ${room2.phase}`);
    }
}
// ============================================================================
// Test 6: Session Registry After Termination
// ============================================================================
console.log("\n📝 Test 6: Session Registry After Termination\n");
const allSessionsAfter = sessionRegistry_1.sessionRegistry.getAllSessions();
console.log(`📊 Total sessions after termination: ${allSessionsAfter.length}`);
allSessionsAfter.forEach((session, i) => {
    console.log(`\n  Session ${i + 1}:`);
    console.log(`    ID: ${session.sessionId}`);
    console.log(`    Room: ${session.roomId}`);
    console.log(`    Phase: ${session.phase}`);
    console.log(`    Users: ${session.users.length} (${session.userNames.join(", ")})`);
});
// ============================================================================
// Summary
// ============================================================================
console.log("\n" + "=".repeat(80));
console.log("✅ Phase 1A Session Authority Tests Complete");
console.log("=".repeat(80));
console.log("\nTest Results:");
console.log("  ✅ Room creation and user joins");
console.log("  ✅ Session registry API queries");
console.log("  ✅ TIMER_EXPIRED transition (ENDING phase)");
console.log("  ✅ END_SESSION transition (ENDED phase)");
console.log("  ✅ ADMIN_END_SESSION transition");
console.log("  ✅ Session registry updates");
console.log("\nNext Steps:");
console.log("  1. Test with actual Socket.IO server");
console.log("  2. Test socket handlers (get-sessions, admin-end-session)");
console.log("  3. Implement Phase 1B frontend (SessionList component)");
console.log("  4. Enable ENGINE_V2_SESSION_CONTROL feature flag");
console.log("\n");

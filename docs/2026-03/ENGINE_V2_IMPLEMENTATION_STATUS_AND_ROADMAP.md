# 🚀 ENGINE V2: IMPLEMENTATION STATUS & ROADMAP

**Date:** March 5, 2026  
**Status:** Phase 1 Complete - Core Transitions Working  
**Next Phase:** Shift Session Authority to V2  
**Goal:** Enable Multiple Concurrent Sessions

---

## 📊 EXECUTIVE SUMMARY

Engine V2 is now successfully tracking user sessions in shadow mode alongside the legacy V1 system. We have implemented and tested the core session lifecycle transitions (JOIN, START, DISCONNECT) and verified they work correctly with multi-user scenarios.

**Current Achievement:** V2 can observe and validate session state without affecting production.

**Next Goal:** Shift session authority from V1 to V2, enabling V2 to control session lifecycle and paving the way for multiple concurrent sessions.

---

## ✅ WHAT WE'VE ACCOMPLISHED

### 1. Fixed TypeScript Import Issues

**Problem:** Module resolution failing with "Cannot find module" errors.

**Solution:** Added `.js` extensions to relative imports (required by TypeScript with `module: "CommonJS"`).

**Files Modified:**

- `engine-v2/reducer/dispatch.ts`
- `engine-v2/state/invariants.ts`

**Result:** All compilation errors resolved ✅

---

### 2. Implemented Core V2 Transitions

#### A. JOIN_SESSION Transition (reducer.ts)

**Purpose:** Add users to session with proper identity tracking.

**Features:**

- Creates new participants with stable userId (socketId)
- Checks avatar availability (rejects if taken)
- Handles reconnects (updates existing participant to CONNECTED)
- Tracks session ID, room ID, display name, participant count
- Returns effects: SYSTEM_LOG, SOCKET_EMIT_ROOM

**Key Code:**

```typescript
case ActionTypes.JOIN_SESSION: {
  // Validate user and avatar
  // Check for existing participant (reconnect scenario)
  // Check avatar availability
  // Create new participant
  // Set presence to CONNECTED
  // Add to participants Map
  // Return effects
}
```

**Logs Session Context:**

```
[V2 Reducer] 🚪 JOIN_SESSION | Room: default-room | Session: 1d6da654... | User: Kzt1P_vJenstjx_yAAAL
[V2 Reducer] ✅ amit joined | Total participants: 1 | Phase: LOBBY
```

---

#### B. DISCONNECT Transition (reducer.ts)

**Purpose:** Handle user disconnection with Ghost Mode support.

**Features:**

- Sets user presence to GHOST (preserves seat and avatar)
- Tracks if speaker disconnects
- Only clears speaker when ALL users are ghosts
- Maintains participant in Map (can reconnect)
- Logs ghost count, connected count, speaker status
- Returns effects: SYSTEM_LOG, SOCKET_EMIT_ROOM

**Ghost Mode Philosophy:**

- User disconnects → becomes GHOST
- Ghost keeps their seat and avatar
- Ghost excluded from consensus voting
- Ghost can reconnect seamlessly
- Only multiple ghosts trigger session pause

**Key Code:**

```typescript
case ActionTypes.DISCONNECT: {
  // Set to GHOST (don't remove from participants)
  participant.presence = "GHOST";
  participant.socketId = null;

  // Check if speaker went ghost
  if (tableState.liveSpeaker === userId) {
    // Check if ALL users are now ghosts
    const connectedCount = getConnectedCount();

    if (connectedCount === 0) {
      // All ghost → clear speaker
      tableState.liveSpeaker = null;
    } else {
      // Speaker keeps mic while ghost
    }
  }
}
```

**Logs:**

```
[V2 Reducer] 👻 DISCONNECT | Room: default-room | Session: 1d6da654... | User: Kzt1P_vJenstjx_yAAAL
[V2 Reducer] ✅ amit → GHOST | Connected: 1 | Ghosts: 1
```

---

#### C. CLICK_READY_TO_GLOW Transition (reducer.ts)

**Purpose:** Start session and transition from LOBBY to ATTENTION_SELECTION.

**Features:**

- Transitions phase: `LOBBY → ATTENTION_SELECTION`
- Starts session timer (default 60 min, or custom duration)
- Validates user exists and is CONNECTED
- Logs session start, duration, phase transition
- Returns effects: SYSTEM_LOG, SOCKET_EMIT_ROOM, TIMER_START

**Key Code:**

```typescript
case ActionTypes.CLICK_READY_TO_GLOW: {
  // Validate user is CONNECTED
  // Only allow from LOBBY phase

  // Transition to ATTENTION_SELECTION (picker mode)
  tableState.phase = "ATTENTION_SELECTION";

  // Start timer
  const durationMs = durationMinutes * 60 * 1000;
  tableState.timer = {
    active: true,
    startTime: Date.now(),
    durationMs,
    endTime: Date.now() + durationMs,
  };

  // Return effects
}
```

**Logs:**

```
[V2 Reducer] ✨ CLICK_READY_TO_GLOW | Room: default-room | Session: 1d6da654... | User: Kzt1P_vJenstjx_yAAAL
[V2 Reducer] ✅ Session started by amit | Phase: LOBBY → ATTENTION_SELECTION | Duration: 60 minutes
```

---

### 3. Fixed UserId Consistency Issue

**Problem:** Different actions were using different identifiers:

- JOIN used `socket.id` ✅
- START_SESSION used `user.name` ❌
- DISCONNECT used `user.name` ❌

**Solution:** Standardized all shadow dispatch calls to use `socket.id` consistently.

**Files Modified:**

- `server/socketHandler.ts` (4 shadow hooks)
- `server/engine-v2/shadow/actionMapper.ts` (JOIN_SESSION payload)

**Changes:**

```typescript
// Before (inconsistent)
const userId = extractUserId(socket, { userId: user.name });

// After (consistent)
const userId = socket.id; // Always use socketId
```

**Result:** All actions now use stable `socket.id` as userId ✅

---

### 4. Enhanced Shadow Mode Logging

**Purpose:** Provide detailed visibility into V2 state transitions.

**Features:**

- Shows Session ID (first 8 chars) in every log
- Highlights changes with ✨ emoji
- Shows effect types generated
- Tracks participant counts per session
- Before/after state comparison

**Log Format:**

```
[V2 Shadow] 🎯 Room: default-room | Session: 1d6da654... | User: amit | Action: JOIN_SESSION
  Phase: LOBBY
  Connected: 0 → 1 ✨
  Ghosts: 0 → 0 ✨
  Total Participants: 0 → 1 ✨
  Effects Generated: 2
    → SYSTEM_LOG, SOCKET_EMIT_ROOM
  Invariants: ✅ OK
```

---

### 5. Fixed Presence State Bug

**Problem:** New users were created as GHOST instead of CONNECTED.

**Root Cause:** `createParticipantState()` set presence based on socketId:

```typescript
presence: socketId ? "CONNECTED" : "GHOST";
```

But socketId was sometimes undefined/null.

**Solution:** Explicitly set presence to CONNECTED after participant creation:

```typescript
const newParticipant = createParticipantState(...);
newParticipant.presence = "CONNECTED"; // Ensure CONNECTED on join
```

**Result:** Users now correctly join as CONNECTED ✅

---

## 🧪 TEST RESULTS

### Test 1: Single User Join + Start Session

**Scenario:** amit joins as first user, starts 60-minute session.

**Results:**

- ✅ User tracked: Connected: 0 → 1
- ✅ Phase transition: LOBBY → ATTENTION_SELECTION
- ✅ Effects generated: 3 (SYSTEM_LOG, SOCKET_EMIT_ROOM, TIMER_START)
- ✅ Session ID assigned: 1d6da654-e5c8-4944-96f2-8092e0d5c336
- ✅ All invariants passed

**Logs:**

```
[V2 Reducer] 🚪 JOIN_SESSION | User: Kzt1P_vJenstjx_yAAAL
[V2 Reducer] ✅ amit joined | Total participants: 1 | Phase: LOBBY

[V2 Reducer] ✨ CLICK_READY_TO_GLOW | User: Kzt1P_vJenstjx_yAAAL
[V2 Reducer] ✅ Session started by amit | Phase: LOBBY → ATTENTION_SELECTION | Duration: 60 minutes
```

---

### Test 2: Second User Joins Active Session

**Scenario:** oren joins while amit's session is already running.

**Results:**

- ✅ User tracked: Connected: 1 → 2
- ✅ Phase preserved: ATTENTION_SELECTION (session already active)
- ✅ Same session ID: 1d6da654... (both users in same session)
- ✅ Total participants: 2
- ✅ All invariants passed

**Logs:**

```
[V2 Reducer] 🚪 JOIN_SESSION | User: X8GjeibUWwYuFewIAAAJ
[V2 Reducer] ✅ oren joined | Total participants: 2 | Phase: ATTENTION_SELECTION

[V2 Shadow] Connected: 1 → 2 ✨
[V2 Shadow] Total Participants: 1 → 2 ✨
[V2 Shadow] Same Session: 1d6da654...
```

---

### Test 3: Multi-User Session Tracking

**Evidence:** V2 successfully tracks multiple users in the same session.

**Key Metrics:**

- Room ID: `default-room` (shared)
- Session ID: `1d6da654-e5c8-4944-96f2-8092e0d5c336` (shared)
- Total Participants: 2
- Connected Users: 2
- Ghost Users: 0
- Phase: ATTENTION_SELECTION
- All Invariants: ✅ OK

**Conclusion:** V2 can manage multi-user sessions correctly.

---

## 🎯 CURRENT STATE: V2 CAPABILITIES

### ✅ What V2 Can Do (Implemented)

1. **Track users** - Add to participants Map with stable userId
2. **Manage session lifecycle** - Start sessions, track phase transitions
3. **Handle disconnections** - Ghost mode support
4. **Validate state** - 14 invariants enforced after every action
5. **Log comprehensively** - Detailed session/room/user context
6. **Multi-user support** - Multiple users in same session

### ⏳ What V2 Cannot Do Yet (Not Implemented)

1. **Control session lifecycle** - V1 still owns `sessionActive`, timers
2. **Execute effects** - V2 returns effects but nothing runs them
3. **Consensus calculation** - POINT_TO_USER transition not implemented
4. **Mic control** - DROP_MIC, PASS_MIC transitions not implemented
5. **Room isolation** - All sessions go to "default-room"
6. **Multiple concurrent sessions** - No room routing

---

## 🚧 ARCHITECTURAL GAP: V1 vs V2

### Current Architecture (Hybrid)

```
┌─────────────────────────────────────────────┐
│  CLIENT (Browser)                           │
│  - Emits: request-join, start-session, etc │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  SOCKET.IO EVENT HANDLERS (socketHandler.ts)│
│  ┌─────────────────────────────────────┐   │
│  │ V1 LOGIC (Controls Everything)      │   │
│  │ - sessionActive (boolean)           │   │
│  │ - sessionTimer (NodeJS.Timeout)     │   │
│  │ - users (Map<socketId, UserInfo>)   │   │
│  │ - pointerMap (Map<from, to>)        │   │
│  │ - liveSpeaker (string | null)       │   │
│  │                                      │   │
│  │ V1 ACTUALLY DOES THINGS:            │   │
│  │ - Creates sessions                  │   │
│  │ - Manages timers                    │   │
│  │ - Evaluates consensus               │   │
│  │ - Broadcasts to clients             │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ V2 SHADOW (Observes Only)           │   │
│  │ - shadowDispatch(roomId, userId, action)│
│  │ - Logs state transitions            │   │
│  │ - Validates invariants              │   │
│  │ - Returns effects (not executed)    │   │
│  │                                      │   │
│  │ V2 DOES NOT DO ANYTHING YET:        │   │
│  │ - Effects are ignored               │   │
│  │ - State changes are local only      │   │
│  │ - No authority over session         │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### The Problem

**V1 and V2 maintain separate state:**

- V1: `sessionActive`, `sessionTimer`, `users`, `pointerMap`, `liveSpeaker`
- V2: `TableState { participants, phase, timer, liveSpeaker, pointerMap }`

**They track the SAME session but in different data structures!**

This means:

- ❌ V2 cannot control session lifecycle
- ❌ V2 effects are not executed
- ❌ No room isolation (V1 is global, V2 is room-scoped)
- ❌ Cannot enable multiple concurrent sessions

---

## 🎯 PHASE 2: SHIFT SESSION AUTHORITY TO V2

### Goal

Transfer session lifecycle control from V1 → V2 while keeping V1 UI/panel logic intact.

### Strategy

**V2 becomes the source of truth for session state. V1 becomes a "view layer" that queries V2.**

---

## 📋 IMPLEMENTATION PLAN: SESSION AUTHORITY SHIFT

### Step 1: Effect Execution System

**Create effect runner in V2 that actually executes returned effects.**

**New File:** `engine-v2/effects/effectRunner.ts`

```typescript
import { Effect } from "../state/types";
import { Server } from "socket.io";
import { RoomRegistry } from "../registry/RoomRegistry";

export function runEffects(
  effects: Effect[],
  io: Server,
  roomRegistry: RoomRegistry,
): void {
  for (const effect of effects) {
    try {
      switch (effect.type) {
        case "SOCKET_EMIT_ROOM":
          // Room-scoped emit (for single room)
          io.to(effect.roomId).emit(effect.event, effect.data);
          break;

        case "SOCKET_EMIT_USER":
          // User-scoped emit (find their socket)
          const room = roomRegistry.getRoom(effect.roomId);
          const participant = room?.participants.get(effect.userId);
          if (participant?.socketId) {
            io.to(participant.socketId).emit(effect.event, effect.data);
          }
          break;

        case "TIMER_START":
          // Start session timer
          startSessionTimer(effect.roomId, effect.durationMs, io, roomRegistry);
          break;

        case "TIMER_CANCEL":
          // Cancel session timer
          cancelSessionTimer(effect.roomId);
          break;

        case "GLIFF_APPEND":
          // Append to gliff log
          gliffService.append(effect.roomId, effect.entry);
          break;

        case "SYSTEM_LOG":
          // Log to console
          console.log(`[V2 System] ${effect.message}`);
          break;

        default:
          console.warn(`[Effect Runner] Unknown effect type: ${effect.type}`);
      }
    } catch (error) {
      console.error(`[Effect Runner] Failed to execute effect:`, error);
    }
  }
}
```

**Why This Matters:**

- V2 transitions return effects
- Effects describe what to do (emit socket, start timer, etc)
- Effect runner ACTUALLY DOES IT
- This is how V2 takes control

---

### Step 2: Integrate Effect Runner into Socket Handler

**Modify:** `server/socketHandler.ts`

**Current (Shadow Mode):**

```typescript
socket.on("start-session", ({ durationMinutes }) => {
  // V1 logic (unchanged)
  startSessionWithDuration(io, durationMinutes);

  // V2 shadow (observes only)
  shadowDispatch(roomId, userId, action); // ❌ Effects ignored
});
```

**After (V2 Control):**

```typescript
socket.on("start-session", ({ durationMinutes }) => {
  // V2 TAKES CONTROL
  const roomId = extractRoomId(socket, { durationMinutes });
  const userId = socket.id;
  const action = mapLegacyToV2Action("start-session", { durationMinutes });

  // Dispatch and run effects
  const effects = dispatch(roomId, userId, action); // ✅ V2 creates effects
  runEffects(effects, io, roomRegistry); // ✅ Effects executed

  // V1 logic becomes observer (query V2 state for UI updates)
  const room = roomRegistry.getRoom(roomId);
  sessionActive = room.phase !== "LOBBY"; // Sync V1 state from V2
});
```

**Key Change:** V2 now CONTROLS, V1 FOLLOWS.

---

### Step 3: Session State Query API

**Create API for V1 to query V2 session state.**

**New File:** `engine-v2/api/sessionQueries.ts`

```typescript
import { roomRegistry } from "../registry/RoomRegistry";

export function getSessionState(roomId: string) {
  const room = roomRegistry.getRoom(roomId);
  if (!room) {
    return {
      exists: false,
      sessionActive: false,
      phase: "LOBBY",
      participantCount: 0,
    };
  }

  return {
    exists: true,
    sessionId: room.sessionId,
    roomId: room.roomId,
    sessionActive: room.phase !== "LOBBY",
    phase: room.phase,
    participantCount: room.participants.size,
    connectedCount: getConnectedCount(room),
    ghostCount: getGhostCount(room),
    liveSpeaker: room.liveSpeaker,
    timer: room.timer,
  };
}

export function isSessionActive(roomId: string): boolean {
  const room = roomRegistry.getRoom(roomId);
  return room ? room.phase !== "LOBBY" : false;
}

export function getParticipants(roomId: string) {
  const room = roomRegistry.getRoom(roomId);
  return room ? Array.from(room.participants.values()) : [];
}
```

**Why This Matters:**

- V1 no longer maintains `sessionActive`, `sessionTimer`, etc
- V1 ASKS V2 for state: `const active = isSessionActive(roomId);`
- Single source of truth: V2

---

### Step 4: Migrate Session Timer to V2

**Current Problem:** V1 manages timer with `setTimeout()` and global state.

**Solution:** V2 manages timer lifecycle through effects.

**Timer Effect Handler:**

```typescript
// In effectRunner.ts

const sessionTimers = new Map<string, NodeJS.Timeout>();

function startSessionTimer(
  roomId: string,
  durationMs: number,
  io: Server,
  roomRegistry: RoomRegistry,
) {
  // Cancel existing timer
  cancelSessionTimer(roomId);

  // Start new timer
  const timer = setTimeout(() => {
    // Dispatch TIMER_EXPIRED action when time's up
    const action = { type: "TIMER_EXPIRED", payload: {} };
    const effects = dispatch(roomId, null, action);
    runEffects(effects, io, roomRegistry);
  }, durationMs);

  sessionTimers.set(roomId, timer);

  // Start timer broadcast (every second)
  startTimerBroadcast(roomId, durationMs, io, roomRegistry);
}

function cancelSessionTimer(roomId: string) {
  const timer = sessionTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    sessionTimers.delete(roomId);
  }
  stopTimerBroadcast(roomId);
}
```

**Implement TIMER_EXPIRED Transition:**

```typescript
// In reducer.ts

case ActionTypes.TIMER_EXPIRED: {
  console.log(`[V2 Reducer] ⏰ TIMER_EXPIRED | Room: ${tableState.roomId}`);

  // Transition to ENDING phase
  tableState.phase = "ENDING";
  tableState.timer.active = false;

  return [
    {
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: "Session time expired",
      level: "info",
    },
    {
      type: "SOCKET_EMIT_ROOM",
      roomId: tableState.roomId,
      event: "session-ended",
      data: {
        reason: "timer-expired",
        navigateToHome: true,
      },
    },
    {
      type: "SCHEDULE_CLEANUP",
      roomId: tableState.roomId,
      delayMs: 30000, // 30s grace period
    },
  ];
}
```

**Why This Matters:**

- V2 controls timer lifecycle
- Timer expiration triggers V2 action
- V2 handles cleanup and phase transitions
- No more global timer state in V1

---

### Step 5: Deprecate V1 Session Functions

**Mark as deprecated, redirect to V2:**

```typescript
// In socketHandler.ts

/**
 * @deprecated Use V2 session control via dispatch()
 */
function startSessionWithDuration(io: Server, durationMinutes: number = 60) {
  console.warn(
    "⚠️ [DEPRECATED] startSessionWithDuration called - use V2 instead",
  );

  // Redirect to V2
  const roomId = "default-room";
  const action = {
    type: "CLICK_READY_TO_GLOW",
    payload: { durationMinutes },
  };
  const effects = dispatch(roomId, null, action);
  runEffects(effects, io, roomRegistry);
}
```

**Gradually remove V1 session state:**

```typescript
// Remove these (V2 manages them now):
// let sessionActive = false;
// let sessionTimer: NodeJS.Timeout | null = null;
// let sessionStartTime: Date | null = null;
// let sessionId: string | null = null;

// Replace with V2 queries:
function getSessionActive(): boolean {
  return isSessionActive("default-room"); // Query V2
}
```

---

### Step 6: Test Session Authority Shift

**Test Scenarios:**

1. **Start Session (V2 Controlled)**
   - User clicks "Start Session"
   - V2 receives CLICK_READY_TO_GLOW
   - V2 transitions phase: LOBBY → ATTENTION_SELECTION
   - V2 starts timer via TIMER_START effect
   - Effect runner executes timer
   - V1 sees sessionActive = true (queries V2)

2. **Timer Expiration (V2 Controlled)**
   - Timer expires
   - V2 receives TIMER_EXPIRED action
   - V2 transitions phase: ATTENTION_SELECTION → ENDING
   - V2 emits session-ended event
   - Users navigate to home
   - V2 schedules cleanup after 30s grace period

3. **Multi-User Session**
   - User A starts session (V2 control)
   - User B joins (V2 tracks)
   - Both users in same V2 room
   - Session state shared
   - Timer consistent

**Expected Results:**

- ✅ V2 controls session lifecycle
- ✅ V1 queries V2 for state
- ✅ Effects execute correctly
- ✅ Timer works
- ✅ Session ends properly

---

## 🏗️ PHASE 3: ENABLE MULTIPLE CONCURRENT SESSIONS

**Once V2 has session authority, we can add multiple rooms.**

### Overview

Currently, all users go to a single "default-room". To support multiple concurrent sessions:

1. **Add room routing** - Users choose which room/table to join
2. **Create room UI** - Home page shows available tables
3. **Instantiate multiple rooms** - Each table gets its own `TableState`
4. **Socket.IO room support** - Users join specific Socket.IO rooms
5. **Implement LEAVE_SESSION** - Users can leave one room and join another

---

### Home Page: Table Selection UI

**New Feature:** Display multiple "tables" users can join.

**UI Mockup:**

```
┌────────────────────────────────────────────┐
│        🌐 SoulCircle - Choose a Table      │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────┐  ┌──────────────┐       │
│  │  Table 1     │  │  Table 2     │       │
│  │  🟢 Active   │  │  🔴 Empty    │       │
│  │  3/12 users  │  │  0/12 users  │       │
│  │  💬 Speaking │  │  🪑 Waiting  │       │
│  │              │  │              │       │
│  │  [Join] 🚪   │  │  [Join] 🚪   │       │
│  └──────────────┘  └──────────────┘       │
│                                            │
│  ┌──────────────┐  ┌──────────────┐       │
│  │  Table 3     │  │  Table 4     │       │
│  │  🟡 Lobby    │  │  🔴 Empty    │       │
│  │  1/12 users  │  │  0/12 users  │       │
│  │  ⏱️ Starting │  │  🪑 Waiting  │       │
│  │              │  │              │       │
│  │  [Join] 🚪   │  │  [Join] 🚪   │       │
│  └──────────────┘  └──────────────┘       │
│                                            │
│             [Create New Table] ➕          │
└────────────────────────────────────────────┘
```

**Features:**

- Show all active tables
- Display table status (Empty, Lobby, Active, Speaking)
- Show participant count (3/12)
- Color-coded status indicators
- Join button for each table
- Create new table option

---

### Implementation: Table List API

**New Endpoint:** `GET /api/tables`

```typescript
// In routes/tableRoutes.ts

app.get("/api/tables", (req, res) => {
  const tables = roomRegistry.listRooms();

  const tableList = tables.map((roomId) => {
    const state = getSessionState(roomId);
    return {
      roomId,
      sessionId: state.sessionId,
      status: getTableStatus(state.phase, state.participantCount),
      participantCount: state.participantCount,
      maxParticipants: 12,
      phase: state.phase,
      liveSpeaker: state.liveSpeaker,
      isActive: state.sessionActive,
    };
  });

  res.json({ tables: tableList });
});

function getTableStatus(phase: string, count: number): string {
  if (count === 0) return "empty";
  if (phase === "LOBBY") return "lobby";
  if (phase === "ATTENTION_SELECTION") return "picking";
  if (phase === "LIVE_SPEAKER") return "speaking";
  return "active";
}
```

**Response:**

```json
{
  "tables": [
    {
      "roomId": "table-1",
      "sessionId": "1d6da654-e5c8-4944-96f2-8092e0d5c336",
      "status": "speaking",
      "participantCount": 3,
      "maxParticipants": 12,
      "phase": "LIVE_SPEAKER",
      "liveSpeaker": "amit",
      "isActive": true
    },
    {
      "roomId": "table-2",
      "sessionId": null,
      "status": "empty",
      "participantCount": 0,
      "maxParticipants": 12,
      "phase": "LOBBY",
      "liveSpeaker": null,
      "isActive": false
    }
  ]
}
```

---

### Implementation: Room Selection Flow

**Client Flow:**

1. User opens home page
2. Client fetches `/api/tables`
3. Display table cards
4. User clicks "Join" on a table
5. Client emits `request-join` with `roomId`
6. Server routes user to specific room

**Server Changes:**

```typescript
// In socketHandler.ts

socket.on("request-join", ({ name, avatarId, roomId }) => {
  // Default to "default-room" if not specified (backward compatible)
  const targetRoomId = roomId || "default-room";

  // Store roomId in socket data
  socket.data.roomId = targetRoomId;

  // Join Socket.IO room (for room-scoped broadcasts)
  socket.join(targetRoomId);

  // Validate name/avatar (check within this room only)
  const room = roomRegistry.getOrCreateRoom(targetRoomId);
  const nameAvailable = checkNameAvailable(targetRoomId, name);
  const avatarAvailable = checkAvatarAvailable(targetRoomId, avatarId);

  if (!nameAvailable || !avatarAvailable) {
    socket.emit("join-rejected", {
      reason: "Name or avatar taken in this room",
    });
    return;
  }

  // Dispatch JOIN_SESSION to V2
  const action = {
    type: "JOIN_SESSION",
    payload: { displayName: name, avatarId, socketId: socket.id },
  };
  const effects = dispatch(targetRoomId, socket.id, action);
  runEffects(effects, io, roomRegistry);
});
```

**Key Changes:**

- Socket joins specific `roomId` via `socket.join(roomId)`
- All emits use `io.to(roomId).emit()` instead of `io.emit()`
- Avatar/name availability checked per-room
- Multiple rooms can have different sessions simultaneously

---

### Implementation: Create New Table

**New Endpoint:** `POST /api/tables/create`

```typescript
app.post("/api/tables/create", (req, res) => {
  const { creatorName } = req.body;

  // Generate new room ID
  const roomId = `table-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  // Create room in registry
  const room = roomRegistry.createRoom(roomId);

  console.log(`[API] New table created: ${roomId} by ${creatorName}`);

  res.json({
    success: true,
    roomId,
    message: "Table created successfully",
  });
});
```

**Client Flow:**

1. User clicks "Create New Table"
2. Client calls `POST /api/tables/create`
3. Server returns new `roomId`
4. Client redirects to `/room/${roomId}`
5. Client emits `request-join` with new `roomId`

---

### Implementation: Leave Current Room, Join Another

**New Action:** `LEAVE_SESSION`

**Transition:**

```typescript
// In reducer.ts

case ActionTypes.LEAVE_SESSION: {
  console.log(`[V2 Reducer] 👋 LEAVE_SESSION | Room: ${tableState.roomId} | User: ${userId}`);

  const participant = tableState.participants.get(userId);
  if (!participant) return [];

  // Remove from participants
  tableState.participants.delete(userId);

  // Clear pointers
  tableState.pointerMap.delete(userId);
  for (const [from, to] of tableState.pointerMap.entries()) {
    if (to === userId) tableState.pointerMap.delete(from);
  }

  // Clear speaker if leaving user was speaking
  if (tableState.liveSpeaker === userId) {
    tableState.liveSpeaker = null;
    tableState.phase = "ATTENTION_SELECTION";
  }

  // Release avatar
  releaseAvatarInRoom(tableState.roomId, participant.avatarId);

  return [
    {
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: `${participant.displayName} left the table`,
      level: "info",
    },
    {
      type: "SOCKET_EMIT_ROOM",
      roomId: tableState.roomId,
      event: "user-left",
      data: { userId, displayName: participant.displayName },
    },
  ];
}
```

**Socket Handler:**

```typescript
socket.on("leave-room", ({ roomId }) => {
  // Dispatch LEAVE_SESSION to current room
  const currentRoom = socket.data.roomId;
  if (currentRoom) {
    const action = { type: "LEAVE_SESSION", payload: {} };
    const effects = dispatch(currentRoom, socket.id, action);
    runEffects(effects, io, roomRegistry);

    // Leave Socket.IO room
    socket.leave(currentRoom);
  }

  // User can now join a different room
  socket.emit("left-room", { success: true });
});
```

---

## 📊 IMPLEMENTATION TIMELINE

### Week 1: Effect Execution & Session Authority

**Goal:** V2 controls session lifecycle

**Tasks:**

- [ ] Day 1-2: Implement effect runner
- [ ] Day 3: Integrate effect runner into socket handlers
- [ ] Day 4: Migrate session timer to V2
- [ ] Day 5: Create session state query API
- [ ] Day 6-7: Test session authority shift

**Deliverables:**

- Effect runner working
- V2 controls session start/end
- V1 queries V2 for state
- All V1 functionality preserved

---

### Week 2: Room Routing & Multiple Sessions

**Goal:** Enable multiple concurrent sessions

**Tasks:**

- [ ] Day 8-9: Add room routing to socket handlers
- [ ] Day 10: Implement LEAVE_SESSION transition
- [ ] Day 11: Create table list API
- [ ] Day 12: Build home page table selection UI
- [ ] Day 13: Implement create new table endpoint
- [ ] Day 14: Test multi-room scenarios

**Deliverables:**

- Multiple rooms working simultaneously
- Users can see available tables
- Users can join specific tables
- Users can create new tables
- Users can switch tables

---

### Week 3: Polish & Production

**Goal:** Production-ready multi-session system

**Tasks:**

- [ ] Day 15-16: Room cleanup and garbage collection
- [ ] Day 17: Implement room capacity limits (12 users max)
- [ ] Day 18: Add room metadata (created date, session duration, etc)
- [ ] Day 19: Testing and bug fixes
- [ ] Day 20-21: Production deployment

**Deliverables:**

- Stable multi-session system
- Room cleanup working
- Capacity limits enforced
- Ready for production

---

## 🎯 SUCCESS CRITERIA

### Phase 1 (Current) ✅

- [x] V2 tracks users (JOIN_SESSION)
- [x] V2 starts sessions (CLICK_READY_TO_GLOW)
- [x] V2 handles disconnects (DISCONNECT/Ghost Mode)
- [x] All invariants passing
- [x] Multi-user sessions working

### Phase 2 (Session Authority)

- [ ] V2 controls session start/end
- [ ] Effect runner executes all effects
- [ ] Session timer managed by V2
- [ ] V1 queries V2 for state (not managing its own)
- [ ] No regressions in V1 functionality

### Phase 3 (Multiple Sessions)

- [ ] Multiple rooms working simultaneously
- [ ] Home page shows table list
- [ ] Users can join specific tables
- [ ] Users can create new tables
- [ ] Users can switch between tables
- [ ] Room isolation verified (no cross-contamination)

---

## 🏆 FINAL GOAL

**By end of Week 3:**

Users can:

1. Open home page
2. See list of active tables
3. Join any table (or create new one)
4. Participate in session on that table
5. Leave and join a different table
6. Multiple sessions run simultaneously

Server manages:

1. Multiple concurrent sessions
2. Room-scoped state (no cross-contamination)
3. Session lifecycle (V2 controlled)
4. Room cleanup (garbage collection)
5. Capacity limits (12 users per table)

**Architecture:**

- ✅ V2 owns session authority
- ✅ V1 is view layer (queries V2)
- ✅ Effect-based side effects
- ✅ Room-scoped broadcasts
- ✅ Multi-session support

---

## 📝 NEXT STEPS (Immediate)

### This Week:

1. **Implement effect runner** - Make V2 actually DO things
2. **Wire effect runner** into socket handlers
3. **Test session start** with effect execution
4. **Verify timer works** via V2 control

### Decision Point:

After effect runner works, decide:

- Continue with full session authority shift? OR
- Start implementing table selection UI in parallel?

**Recommendation:** Complete session authority shift first. Clean foundation = easier multiple sessions.

---

## 🎉 ACHIEVEMENTS SO FAR

- ✅ Fixed TypeScript import issues
- ✅ Implemented 3 core transitions (JOIN, DISCONNECT, START)
- ✅ Fixed userId consistency
- ✅ Enhanced shadow logging
- ✅ Fixed presence state bug
- ✅ Tested multi-user sessions
- ✅ Validated V2 can track state correctly
- ✅ All invariants passing
- ✅ Zero production impact (shadow mode)

**V2 is ready to take control. Let's ship it!** 🚀

---

**Document Version:** 1.0  
**Last Updated:** March 5, 2026  
**Next Review:** After Effect Runner Implementation  
**Status:** Ready for Phase 2 Implementation

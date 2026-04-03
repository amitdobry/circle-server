# 🔧 ENGINE V2: ARCHITECTURAL REFINEMENTS

**Date:** February 21, 2026  
**Status:** Pre-Implementation Edge Case Analysis  
**Purpose:** Address structural concerns before Day 1 implementation

---

## 1️⃣ MISSING INVARIANT: REVERSE PHASE CONSTRAINT

### Current Gap

**Existing Invariant 7:**

```typescript
phase === LIVE_SPEAKER ⇒ liveSpeaker !== null
```

**Missing Reverse:**

```typescript
phase === ATTENTION_SELECTION ⇒ liveSpeaker === null
```

### ✅ CONFIRMED: Add This Invariant

**Invariant 11: Picker Phase Exclusivity**

```typescript
phase === ATTENTION_SELECTION ⇒ liveSpeaker === null
```

**Rationale:** Picker mode means "choosing who speaks next." If someone is already speaking, we're not in picker mode.

---

### Complete Phase-to-Speaker Invariants

| Phase                 | liveSpeaker Constraint        | syncPause Constraint |
| --------------------- | ----------------------------- | -------------------- |
| `LOBBY`               | `=== null`                    | `=== false`          |
| `ATTENTION_SELECTION` | `=== null`                    | `=== false`          |
| `SYNC_PAUSE`          | Can be any (candidate locked) | `=== true`           |
| `LIVE_SPEAKER`        | `!== null`                    | `=== false`          |
| `TRANSITION`          | `!== null` (until handoff)    | `=== false`          |
| `ENDING`              | `=== null`                    | `=== false`          |
| `ENDED`               | `=== null`                    | `=== false`          |

### Additional Invariants to Add

**Invariant 12: Lobby Initialization**

```typescript
phase === LOBBY ⇒ liveSpeaker === null AND syncPause === false
```

**Invariant 13: Transition Coherence**

```typescript
phase === TRANSITION ⇒ liveSpeaker !== null
```

_Transition means "handoff in progress," so outgoing speaker still holds seat until resolved._

**Invariant 14: Ending Cleanup**

```typescript
phase === ENDING OR phase === ENDED ⇒ liveSpeaker === null
```

### Updated Invariant Enforcement

```typescript
// state/invariants.ts

export function assertInvariants(tableState: TableState) {
  const { phase, liveSpeaker, syncPause, participants } = tableState;

  // Invariant 7: LIVE_SPEAKER phase requires speaker
  if (phase === "LIVE_SPEAKER" && liveSpeaker === null) {
    throw new InvariantViolation(
      "Phase is LIVE_SPEAKER but liveSpeaker is null",
    );
  }

  // Invariant 11: ATTENTION_SELECTION requires no speaker
  if (phase === "ATTENTION_SELECTION" && liveSpeaker !== null) {
    throw new InvariantViolation(
      "Phase is ATTENTION_SELECTION but liveSpeaker is set",
    );
  }

  // Invariant 12: LOBBY initialization
  if (phase === "LOBBY" && (liveSpeaker !== null || syncPause !== false)) {
    throw new InvariantViolation(
      "LOBBY phase must have no speaker and no syncPause",
    );
  }

  // Invariant 13: TRANSITION coherence
  if (phase === "TRANSITION" && liveSpeaker === null) {
    throw new InvariantViolation(
      "TRANSITION phase requires liveSpeaker (handoff in progress)",
    );
  }

  // Invariant 14: ENDING/ENDED cleanup
  if ((phase === "ENDING" || phase === "ENDED") && liveSpeaker !== null) {
    throw new InvariantViolation("ENDING/ENDED phases must have no speaker");
  }

  // ... rest of invariants
}
```

---

## 2️⃣ SYNC_PAUSE FREEZE RULE

### Problem

During the 2-second `SYNC_PAUSE`:

- Consensus achieved
- Speaker candidate locked
- UI shows sync animation
- User still has pointer control

**What if:** User changes pointer during animation?

### Analysis

**Option A: Hard Reject**

```typescript
if (tableState.phase === "SYNC_PAUSE" && action.type === "POINT_TO_USER") {
  return [
    {
      type: "SOCKET_EMIT_USER",
      userId,
      event: "action-rejected",
      data: { reason: "Sync in progress" },
    },
  ];
}
```

- ✅ Deterministic
- ✅ Clear behavior
- ❌ User confusion ("why can't I point?")

**Option B: Ignore (Silent Drop)**

```typescript
if (tableState.phase === "SYNC_PAUSE" && action.type === "POINT_TO_USER") {
  return []; // No-op
}
```

- ✅ No error spam
- ❌ Silent failure
- ❌ Pointer update never registers

**Option C: Allow But Defer**

```typescript
if (tableState.phase === "SYNC_PAUSE" && action.type === "POINT_TO_USER") {
  // Update pointer for visual feedback, but don't re-evaluate consensus
  tableState.pointerMap.set(userId, payload.targetUserId);
  return [
    {
      type: "SOCKET_EMIT_ROOM",
      roomId: tableState.roomId,
      event: "update-pointing",
      data: { from: userId, to: payload.targetUserId },
    },
  ];
}
```

- ✅ Visual responsiveness
- ✅ Pointer state stays current
- ❌ Consensus already locked, so change is cosmetic only

### ✅ RECOMMENDATION: **Option A (Hard Reject)**

**Rationale:**

1. **Determinism > Flexibility:** SyncPause is a 2-second lock. Users can wait.
2. **Clear Contract:** "Consensus achieved = no more voting."
3. **Simpler Testing:** No edge cases around "pointer changed but didn't count."

**Implementation:**

```typescript
// policy/rules/phaseRules.ts

export function checkPhaseRules(
  actionType: string,
  phase: SessionPhase,
): boolean {
  // Block pointer changes during SYNC_PAUSE
  if (phase === "SYNC_PAUSE" && actionType === "POINT_TO_USER") {
    return false;
  }

  // Block "ready to glow" during LIVE_SPEAKER
  if (phase === "LIVE_SPEAKER" && actionType === "CLICK_READY_TO_GLOW") {
    return false;
  }

  // ... other phase rules
  return true;
}
```

**User Feedback:**

```typescript
// In dispatch.ts, when can() returns false:
if (!can(userId, action.type, room)) {
  return [
    {
      type: "SOCKET_EMIT_USER",
      userId,
      event: "action-rejected",
      data: {
        actionType: action.type,
        reason: "Action not allowed during current phase",
        currentPhase: room.phase,
      },
    },
  ];
}
```

**Client-Side Handling:**

```typescript
// Client disables pointer clicks during SYNC_PAUSE
if (sessionPhase === "SYNC_PAUSE") {
  return <PickerPanel disabled={true} message="Sync in progress..." />;
}
```

### SYNC_PAUSE Frozen Actions

| Action Type           | Behavior During SYNC_PAUSE          |
| --------------------- | ----------------------------------- |
| `POINT_TO_USER`       | ❌ Rejected                         |
| `CLICK_READY_TO_GLOW` | ❌ Rejected                         |
| `SEND_GESTURE`        | ✅ Allowed (emotional expression)   |
| `TEXT_INPUT`          | ❌ Rejected (no typing during lock) |
| `DISCONNECT`          | ✅ Allowed (can't prevent)          |
| `RECONNECT`           | ✅ Allowed (can't prevent)          |

---

## 3️⃣ RECONNECT STATE SNAPSHOT

### Current Gap

**In spec's reconnect transition:**

```typescript
if (user.presence === GHOST) {
  user.presence = CONNECTED;
  user.socketId = newSocketId;
  user.lastSeen = Date.now();
  // ❌ No state snapshot sent to user
}
```

**Problem:** User reconnects but sees stale client state.

### Analysis

**Option A: Explicit Full State Effect**

```typescript
{ type: "EMIT_FULL_STATE_TO_USER", userId, snapshot: { participants, phase, pointerMap, liveSpeaker, gliffLog } }
```

- ✅ Explicit control
- ✅ Can optimize what to send
- ❌ Requires manual effect composition

**Option B: Automatic Projection After Every Dispatch**

```typescript
// After every dispatch, project UI for all affected users
for (const userId of affectedUsers) {
  const panelConfig = resolvePanelConfig(userId, tableState);
  io.to(socketId).emit("panel-config", panelConfig);
}
```

- ✅ Consistent everywhere
- ❌ More network traffic
- ❌ Over-emits (even when UI unchanged)

### ✅ RECOMMENDATION: **Hybrid Approach**

**Rule:** Explicit snapshot on reconnect + targeted updates on normal actions.

```typescript
// reducer/transitions/reconnect.ts

export function reconnect(
  tableState: TableState,
  userId: string,
  payload: { socketId: string },
): Effect[] {
  const effects: Effect[] = [];
  const participant = tableState.participants.get(userId);

  if (!participant || participant.presence !== "GHOST") {
    return []; // Invalid reconnect
  }

  // Restore presence
  participant.presence = "CONNECTED";
  participant.socketId = payload.socketId;
  participant.lastSeen = Date.now();

  // ✅ Emit full state snapshot to reconnecting user
  effects.push({
    type: "EMIT_FULL_STATE_TO_USER",
    userId,
    snapshot: {
      participants: serializeParticipants(tableState),
      phase: tableState.phase,
      pointerMap: serializePointerMap(tableState),
      liveSpeaker: tableState.liveSpeaker,
      syncPause: tableState.syncPause,
      timer: tableState.timer,
    },
  });

  // Emit user-list update to room (show user as reconnected)
  effects.push({
    type: "SOCKET_EMIT_ROOM",
    roomId: tableState.roomId,
    event: "user-list",
    data: serializeParticipants(tableState),
  });

  // Emit panel config to reconnecting user
  effects.push({
    type: "EMIT_PANEL_CONFIG",
    userId,
    config: resolvePanelConfig(userId, tableState),
  });

  return effects;
}
```

### New Effect Types

```typescript
// effects/effectTypes.ts

type Effect =
  | { type: "SOCKET_EMIT_ROOM"; roomId: string; event: string; data: any }
  | { type: "SOCKET_EMIT_USER"; userId: string; event: string; data: any }
  | { type: "EMIT_FULL_STATE_TO_USER"; userId: string; snapshot: StateSnapshot }
  | { type: "EMIT_PANEL_CONFIG"; userId: string; config: PanelConfig }
  | { type: "GLIFF_APPEND"; roomId: string; entry: GliffMessage }
  | { type: "TIMER_START"; roomId: string; durationMs: number }
  | { type: "TIMER_CANCEL"; roomId: string }
  | { type: "SYSTEM_LOG"; roomId: string; message: string }
  | { type: "DELAYED_ACTION"; roomId: string; delayMs: number; action: Action };

interface StateSnapshot {
  participants: SerializedParticipant[];
  phase: SessionPhase;
  pointerMap: Record<userId, targetUserId>;
  liveSpeaker: userId | null;
  syncPause: boolean;
  timer: SessionTimerState;
}
```

### Why This Is Robust

1. **Reconnect = Full Sync:** User always gets complete state on return.
2. **Normal Actions = Targeted Updates:** No over-emission during regular flow.
3. **Panel Config Separated:** UI projection is explicit, not implicit.
4. **Gliff Log Handled Separately:** Fetched via `EMIT_FULL_STATE_TO_USER` → client requests gliff log.

---

## 4️⃣ ROOM CLEANUP POLICY

### Current Gap

**Spec says:**

> "If all users are `GHOST` → session transitions to `ENDING`"

**But doesn't specify:**

- When does `ENDING` → `ENDED` → `destroyRoom()`?
- What triggers cleanup?
- What gets cleaned up?

### Formalized Room Lifecycle

```
CREATE
  ↓ (first user joins)
ACTIVE
  ↓ (timer expires OR all users ghost/left)
ENDING (grace period: 30 seconds)
  ↓ (grace period expires OR explicit end)
ENDED
  ↓ (immediate)
CLEANUP → destroyRoom()
```

### Room Destruction Rules

**Trigger Conditions:**

1. **Timer Expiration** (session ends naturally)

   ```typescript
   if (tableState.timer.active && Date.now() >= tableState.timer.endTime) {
     tableState.phase = "ENDING";
   }
   ```

2. **All Users Ghost** (everyone disconnected)

   ```typescript
   const connected = getConnectedParticipants(tableState);
   if (connected.length === 0 && tableState.participants.size > 0) {
     tableState.phase = "ENDING";
   }
   ```

3. **All Users Left** (participants map empty)

   ```typescript
   if (tableState.participants.size === 0) {
     tableState.phase = "ENDED";
     // Immediate cleanup
   }
   ```

4. **Grace Period Exhausted**
   ```typescript
   if (
     tableState.phase === "ENDING" &&
     Date.now() - tableState.endingStartTime > 30000
   ) {
     tableState.phase = "ENDED";
   }
   ```

### Cleanup Implementation

```typescript
// registry/RoomLifecycle.ts

export class RoomLifecycle {
  private cleanupTimers = new Map<roomId: string, NodeJS.Timeout>();

  scheduleCleanup(roomId: string, tableState: TableState) {
    // Set grace period timer
    const timer = setTimeout(() => {
      this.executeCleanup(roomId);
    }, 30000); // 30 seconds

    this.cleanupTimers.set(roomId, timer);
  }

  executeCleanup(roomId: string) {
    const room = roomRegistry.getRoom(roomId);
    if (!room) return; // Already cleaned

    // 1. Cancel all timers
    timerService.cancel(roomId);

    // 2. Clear gliff log
    gliffService.clear(roomId);

    // 3. Release all avatars
    for (const participant of room.participants.values()) {
      avatarManager.release(participant.avatarId);
    }

    // 4. Clear participants
    room.participants.clear();
    room.pointerMap.clear();

    // 5. Set phase to ENDED
    room.phase = "ENDED";

    // 6. Remove from registry
    roomRegistry.destroyRoom(roomId);

    // 7. Clear cleanup timer
    const timer = this.cleanupTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(roomId);
    }

    console.log(`[RoomLifecycle] Room ${roomId} cleaned up`);
  }

  cancelCleanup(roomId: string) {
    // If someone reconnects during ENDING grace period
    const timer = this.cleanupTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(roomId);
    }
  }
}
```

### Phase Transition Hooks

```typescript
// reducer/transitions/evaluatePhaseTransitions.ts

export function evaluatePhaseTransitions(tableState: TableState): Effect[] {
  const effects: Effect[] = [];

  // Check if all users are ghost or left
  const connected = getConnectedParticipants(tableState);
  const ghosts = Array.from(tableState.participants.values()).filter(
    (p) => p.presence === "GHOST",
  );

  if (connected.length === 0 && ghosts.length > 0) {
    // All ghost → ENDING with grace period
    if (tableState.phase !== "ENDING" && tableState.phase !== "ENDED") {
      tableState.phase = "ENDING";
      tableState.endingStartTime = Date.now();

      effects.push({
        type: "SCHEDULE_CLEANUP",
        roomId: tableState.roomId,
        delayMs: 30000, // 30 seconds grace
      });

      effects.push({
        type: "SYSTEM_LOG",
        roomId: tableState.roomId,
        message: "All users disconnected. Entering grace period...",
      });
    }
  }

  if (connected.length === 0 && tableState.participants.size === 0) {
    // All left → ENDED (immediate cleanup)
    tableState.phase = "ENDED";

    effects.push({
      type: "EXECUTE_CLEANUP",
      roomId: tableState.roomId,
    });
  }

  // Reconnect during grace period
  if (tableState.phase === "ENDING" && connected.length > 0) {
    // Cancel cleanup, return to active phase
    tableState.phase = "ATTENTION_SELECTION";
    tableState.liveSpeaker = null;

    effects.push({
      type: "CANCEL_CLEANUP",
      roomId: tableState.roomId,
    });

    effects.push({
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: "User reconnected. Session resumed.",
    });
  }

  return effects;
}
```

### Memory Leak Safeguards

1. **Automatic Cleanup After 24 Hours:** Even if grace period bugs out.

   ```typescript
   if (Date.now() - tableState.createdAt > 86400000) {
     // Force cleanup after 24 hours
     roomLifecycle.executeCleanup(tableState.roomId);
   }
   ```

2. **Orphan Detection:** Periodic scan for rooms with no participants.

   ```typescript
   setInterval(() => {
     for (const [roomId, room] of roomRegistry.listRooms()) {
       if (
         room.participants.size === 0 &&
         Date.now() - room.lastUpdated > 600000
       ) {
         // No participants for 10 minutes → cleanup
         roomLifecycle.executeCleanup(roomId);
       }
     }
   }, 60000); // Check every minute
   ```

3. **Manual Cleanup Endpoint:** Admin override.
   ```typescript
   app.post("/admin/cleanup-room", (req, res) => {
     const { roomId } = req.body;
     roomLifecycle.executeCleanup(roomId);
     res.json({ success: true });
   });
   ```

---

## 5️⃣ MIGRATION ROLLOUT REFINEMENT

### Current Proposal vs. Your Alternative

**Current Spec:**

- 10% of rooms → v2
- 50% of rooms → v2
- 100% cutover

**Your Proposal:**

- **NEW rooms → v2**
- **Existing rooms → stay on their engine version**

### ✅ RECOMMENDATION: **Your Proposal Is Superior**

**Why:**

1. **No Mid-Session Engine Swap:** Existing sessions never migrate mid-flight.
2. **Simpler Logic:** No percentage calculations, no random assignment.
3. **Deterministic Testing:** "All new rooms after timestamp X use v2."
4. **Natural Rollout:** As old sessions end, v2 naturally becomes dominant.
5. **Rollback Safety:** If v2 breaks, flip flag to route new rooms back to v1.

### Implementation

```typescript
// config/engineVersion.ts

const ENGINE_V2_ENABLED = process.env.ENGINE_V2_ENABLED === "true";
const ENGINE_V2_START_DATE = new Date("2026-03-01T00:00:00Z"); // Rollout date

export function getEngineVersionForRoom(
  roomId: string,
  isNewRoom: boolean,
): "v1" | "v2" {
  // Feature flag override
  if (!ENGINE_V2_ENABLED) {
    return "v1";
  }

  // NEW rooms use v2
  if (isNewRoom) {
    return "v2";
  }

  // EXISTING rooms stay on their version (stored in registry or database)
  const existingRoom = roomRegistry.getRoom(roomId);
  return existingRoom?.engineVersion || "v1";
}
```

```typescript
// socketHandler.ts adapter

socket.on("request-join", ({ name, avatarId, roomId }) => {
  const existingRoom = roomRegistry.getRoom(roomId);
  const isNewRoom = !existingRoom;

  const engineVersion = getEngineVersionForRoom(roomId, isNewRoom);
  socket.data.engineVersion = engineVersion;

  if (engineVersion === "v2") {
    // Route to v2
    const action = {
      type: "JOIN_SESSION",
      payload: { displayName: name, avatarId },
    };
    const effects = dispatch(roomId, generateUserId(), action);
    runEffects(effects, io, roomRegistry);
  } else {
    // Route to v1
    legacyJoinHandler(socket, name, avatarId);
  }
});
```

### Rollout Timeline

| Date    | Behavior                                                |
| ------- | ------------------------------------------------------- |
| Feb 28  | Deploy v2 code, `ENGINE_V2_ENABLED=false`               |
| Mar 1   | Flip `ENGINE_V2_ENABLED=true`, new rooms use v2         |
| Mar 1-7 | Monitor v2 rooms, collect metrics                       |
| Mar 8   | If stable, keep rollout. If broken, flip flag to false. |
| Mar 15  | All old v1 rooms naturally expired, 100% v2             |

### Risk Mitigation

**What if old room tries to use v2 feature?**

- Adapter checks `room.engineVersion` before routing
- If mismatch, reject action or route to correct engine

**What if we need to rollback?**

- Flip `ENGINE_V2_ENABLED=false`
- New rooms go back to v1
- Existing v2 rooms continue (don't mid-session swap)

**Zero Risk Scenario:**

- Old sessions don't migrate (no behavior change)
- New sessions are isolated (can't affect old sessions)

---

## 6️⃣ DELAYED ACTION SAFETY

### Problem

**In spec's evaluateSync:**

```typescript
effects.push({
  type: "DELAYED_ACTION",
  delayMs: 2000,
  action: { type: "SET_LIVE_SPEAKER", payload: { userId: consensus } },
});
```

**Edge Cases During Delay:**

1. Consensus candidate disconnects
2. Room is destroyed
3. Phase changes (user manually ejects speaker)
4. Consensus candidate becomes ghost

### Analysis

**Option A: Guard Checks Inside Transition**

```typescript
export function setLiveSpeaker(
  tableState: TableState,
  userId: string,
): Effect[] {
  const participant = tableState.participants.get(userId);

  // Guard: User no longer exists
  if (!participant) {
    return [
      {
        type: "SYSTEM_LOG",
        roomId: tableState.roomId,
        message: "Speaker candidate left",
      },
    ];
  }

  // Guard: User is ghost
  if (participant.presence !== "CONNECTED") {
    return [
      {
        type: "SYSTEM_LOG",
        roomId: tableState.roomId,
        message: "Speaker candidate disconnected",
      },
    ];
  }

  // Guard: Phase no longer sync pause
  if (tableState.phase !== "SYNC_PAUSE") {
    return [
      {
        type: "SYSTEM_LOG",
        roomId: tableState.roomId,
        message: "Phase changed during sync",
      },
    ];
  }

  // All guards passed → proceed
  tableState.liveSpeaker = userId;
  tableState.phase = "LIVE_SPEAKER";
  tableState.syncPause = false;

  return [
    /* ... effects */
  ];
}
```

- ✅ Explicit validation
- ✅ Clear failure modes
- ✅ Easy to test

**Option B: Cancellation Tokens**

```typescript
interface DelayedActionToken {
  id: string;
  roomId: string;
  action: Action;
  scheduledAt: number;
  cancelled: boolean;
}

const delayedActions = new Map<string, DelayedActionToken>();

function scheduleDelayedAction(
  roomId: string,
  action: Action,
  delayMs: number,
): string {
  const token = {
    id: generateUUID(),
    roomId,
    action,
    scheduledAt: Date.now(),
    cancelled: false,
  };

  delayedActions.set(token.id, token);

  setTimeout(() => {
    const t = delayedActions.get(token.id);
    if (!t || t.cancelled) return;

    dispatch(roomId, null, action);
    delayedActions.delete(token.id);
  }, delayMs);

  return token.id;
}

function cancelDelayedAction(tokenId: string) {
  const token = delayedActions.get(tokenId);
  if (token) {
    token.cancelled = true;
  }
}
```

- ✅ Explicit cancellation
- ❌ More complex state management
- ❌ Token lifecycle tracking

### ✅ RECOMMENDATION: **Option A (Guard Checks)**

**Rationale:**

1. **Simpler:** No token management, no cancellation logic.
2. **Safer:** Every transition validates preconditions anyway.
3. **Testable:** Can unit test `setLiveSpeaker` with invalid state.
4. **Idempotent:** Delayed action either succeeds or no-ops.

### Implementation Pattern

```typescript
// effects/delayedEffects.ts

export function scheduleDelayedAction(
  roomId: string,
  action: Action,
  delayMs: number,
  io: Server,
  roomRegistry: RoomRegistry,
) {
  setTimeout(() => {
    // Validate room still exists
    const room = roomRegistry.getRoom(roomId);
    if (!room) {
      console.warn(`[DelayedAction] Room ${roomId} no longer exists`);
      return;
    }

    // Dispatch with guards
    const effects = dispatch(roomId, null, action);
    runEffects(effects, io, roomRegistry);
  }, delayMs);
}
```

```typescript
// reducer/transitions/setLiveSpeaker.ts

export function setLiveSpeaker(
  tableState: TableState,
  userId: string,
): Effect[] {
  const effects: Effect[] = [];

  // Guard 1: Participant exists
  const participant = tableState.participants.get(userId);
  if (!participant) {
    effects.push({
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: `Cannot set speaker: ${userId} not found`,
    });
    return effects;
  }

  // Guard 2: Participant is connected
  if (participant.presence !== "CONNECTED") {
    effects.push({
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: `Cannot set speaker: ${participant.displayName} is not connected`,
    });
    // Return to picker mode
    tableState.phase = "ATTENTION_SELECTION";
    tableState.syncPause = false;
    return effects;
  }

  // Guard 3: Phase is SYNC_PAUSE
  if (tableState.phase !== "SYNC_PAUSE") {
    effects.push({
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: `Cannot set speaker: phase is ${tableState.phase}, expected SYNC_PAUSE`,
    });
    return effects;
  }

  // All guards passed → set speaker
  tableState.liveSpeaker = userId;
  tableState.phase = "LIVE_SPEAKER";
  tableState.syncPause = false;
  participant.role = "speaker";

  effects.push({
    type: "SYSTEM_LOG",
    roomId: tableState.roomId,
    message: `${participant.displayName} is now speaking`,
  });

  effects.push({
    type: "SOCKET_EMIT_ROOM",
    roomId: tableState.roomId,
    event: "speaker-set",
    data: { speakerId: userId, displayName: participant.displayName },
  });

  // Emit panel configs to all users
  for (const [uid, p] of tableState.participants.entries()) {
    if (p.presence === "CONNECTED") {
      effects.push({
        type: "EMIT_PANEL_CONFIG",
        userId: uid,
        config: resolvePanelConfig(uid, tableState),
      });
    }
  }

  return effects;
}
```

### Room Destruction Cancel

**If room is destroyed during delayed action:**

```typescript
export function executeCleanup(roomId: string) {
  // ... cleanup logic
  // No explicit cancellation needed—guards in setLiveSpeaker will fail
  // because roomRegistry.getRoom(roomId) returns undefined
}
```

**The delayed action naturally no-ops because:**

1. `scheduleDelayedAction` checks if room exists
2. If not, logs warning and returns early
3. No state mutation, no effects executed

---

## 7️⃣ CONSENSUS PATHOLOGY SCAN

### Edge Case Analysis

#### **Case 1: Single Connected User**

**Scenario:**

- Room has 1 connected user (Alice)
- Alice points to herself

**Current Logic:**

```typescript
const connected = [Alice];
const votes = { Alice: 1 };
const required = 1;
// Consensus: Alice (unanimous)
```

**Is This Correct?** ✅ YES

**Why:** Single user = instant consensus. User can speak to themselves (valid use case: solo practice mode).

**Mitigation:** None needed. Behavior is correct.

---

#### **Case 2: All Users Ghost**

**Scenario:**

- Room had 4 users, all disconnected
- All are now ghosts
- pointerMap still has entries

**Current Logic:**

```typescript
const connected = [];
const consensus = evaluateConsensus(tableState); // Returns null (no connected users)

// Invariant 10 triggers:
if (connected.length === 0 && ghosts.length > 0) {
  tableState.phase = "ENDING";
}
```

**Is This Correct?** ✅ YES

**Why:** No connected users = no one to speak. Session should end.

**Mitigation:** Grace period (30s) allows reconnection before cleanup.

---

#### **Case 3: User Reconnects During SYNC_PAUSE**

**Scenario:**

- 4 users achieve consensus on Alice
- Phase = SYNC_PAUSE
- Bob (ghost) reconnects
- Delayed action sets Alice as speaker

**Current Logic:**

```typescript
// Reconnect doesn't affect locked consensus
// setLiveSpeaker executes after 2s → Alice becomes speaker
// Bob sees Alice as speaker when he reconnects
```

**Is This Correct?** ✅ YES

**Why:** SYNC_PAUSE is a lock. Late reconnects don't get to vote retroactively.

**Potential Issue:** Bob might see stale pointer UI until `EMIT_FULL_STATE_TO_USER` fires.

**Mitigation:**

```typescript
// In reconnect transition
effects.push({
  type: "EMIT_FULL_STATE_TO_USER",
  userId,
  snapshot: {
    /* ... includes phase: SYNC_PAUSE */
  },
});

// Client sees SYNC_PAUSE and disables pointer UI
```

---

#### **Case 4: PointerMap Contains Target That Later Leaves**

**Scenario:**

- Alice points to Bob
- Bob disconnects (becomes ghost)
- Consensus evaluation runs

**Current Logic:**

```typescript
// Invariant 2: All values in pointerMap must exist in participants
// Bob still exists in participants (as GHOST)
// Pointer is valid
// But Bob is excluded from consensus math
```

**Is This Correct?** ⚠️ **EDGE CASE**

**Problem:** What if Bob fully leaves (not ghost, but removed from participants)?

```typescript
// Bob leaves (not disconnect, but explicit leave)
tableState.participants.delete(bobUserId);
// Alice's pointer still says: Alice → Bob
// But Bob no longer exists in participants
// ❌ Invariant 2 violation!
```

**Mitigation:**

```typescript
// reducer/transitions/leave.ts (explicit leave)

export function leave(tableState: TableState, userId: string): Effect[] {
  const effects: Effect[] = [];

  // Remove participant
  tableState.participants.delete(userId);

  // Clean up pointers TO this user
  for (const [pointerId, targetId] of tableState.pointerMap.entries()) {
    if (targetId === userId) {
      tableState.pointerMap.delete(pointerId); // Clear dangling pointer
    }
  }

  // Clean up pointer FROM this user
  tableState.pointerMap.delete(userId);

  // If leaving user was live speaker, drop mic
  if (tableState.liveSpeaker === userId) {
    tableState.liveSpeaker = null;
    tableState.phase = "ATTENTION_SELECTION";
  }

  // Re-evaluate consensus
  const consensusEffects = evaluateSync(tableState);
  effects.push(...consensusEffects);

  return effects;
}
```

**New Invariant Enforcement:**

```typescript
// state/invariants.ts

export function assertInvariants(tableState: TableState) {
  // ... existing invariants

  // Invariant 2 (updated): Pointer targets must exist
  for (const [pointerId, targetId] of tableState.pointerMap.entries()) {
    if (!tableState.participants.has(pointerId)) {
      throw new InvariantViolation(
        `Pointer from ${pointerId} but user not in participants`,
      );
    }
    if (!tableState.participants.has(targetId)) {
      throw new InvariantViolation(
        `Pointer to ${targetId} but user not in participants`,
      );
    }
  }
}
```

---

#### **Case 5: Consensus Achieved, Then Candidate Changes Pointer**

**Scenario:**

- Alice, Bob, Charlie all point to Dave
- Consensus achieved: Dave
- Phase = SYNC_PAUSE
- Dave changes his pointer to Alice (curious user)

**Current Logic (with our SYNC_PAUSE freeze):**

```typescript
// Dave's POINT_TO_USER action is rejected (phase = SYNC_PAUSE)
// Consensus remains locked
```

**Is This Correct?** ✅ YES (with freeze rule)

**Without freeze rule:**

- Dave's pointer change would update pointerMap
- But consensus already locked, so doesn't matter
- Just creates UI confusion

**Mitigation:** Freeze rule (Option A from earlier) prevents this.

---

#### **Case 6: Late Joiner During Consensus Evaluation**

**Scenario:**

- Alice, Bob pointing to each other (no consensus)
- evaluateSync runs
- Carol joins mid-evaluation
- Consensus math doesn't include Carol

**Is This Correct?** ✅ YES

**Why:** Consensus evaluation is synchronous. Carol joins after evaluation completes.

**Next Evaluation:** Carol's pointer will be included.

**Edge Case:** What if Carol joins during SYNC_PAUSE?

```typescript
// Carol joins
// Phase = SYNC_PAUSE
// Carol sees locked state, can't vote
// setLiveSpeaker executes after 2s
// Carol becomes listener automatically
```

**Is This Correct?** ✅ YES. Late joiners don't disrupt ongoing consensus.

---

#### **Case 7: Two Users Point to Each Other, Third User Ghost**

**Scenario:**

- Alice points to Bob
- Bob points to Alice
- Charlie (ghost)
- No consensus

**Current Logic:**

```typescript
const connected = [Alice, Bob];
const votes = { Alice: 1, Bob: 1 };
// No candidate has 2 votes → null
```

**Is This Correct?** ✅ YES

**What if Charlie reconnects and points to Alice?**

```typescript
const connected = [Alice, Bob, Charlie];
const votes = { Alice: 2, Bob: 1 };
// Alice has 2/3 votes → no consensus (requires 100%)
```

**Is This Correct?** ✅ YES. Consensus requires unanimous vote.

---

### Summary: Overlooked Consensus Edge Cases

| Edge Case                           | Current Behavior              | Fix Needed?                        |
| ----------------------------------- | ----------------------------- | ---------------------------------- |
| Single user points to self          | Consensus achieved            | ✅ Correct                         |
| All users ghost                     | Phase → ENDING                | ✅ Correct                         |
| Reconnect during SYNC_PAUSE         | Late joiner sees locked state | ✅ Correct with snapshot           |
| Pointer target leaves               | ❌ Dangling pointer           | ⚠️ FIX: Clean up pointers on leave |
| Consensus candidate changes pointer | Rejected if SYNC_PAUSE        | ✅ Correct with freeze             |
| Late join during evaluation         | Excluded from current round   | ✅ Correct                         |
| Split vote with ghost               | No consensus until unanimous  | ✅ Correct                         |

**Action Items:**

1. ✅ Add pointer cleanup in `leave` transition
2. ✅ Add invariant check for dangling pointers
3. ✅ Emit full state snapshot on reconnect

---

## 8️⃣ STRUCTURAL OVERENGINEERING CHECK

### What Should Be Simplified Now?

#### **1. Policy Engine → Defer**

**Current Spec:**

```typescript
// policy/can.ts with role-based overrides
```

**Reality:**

- Only 2 roles in use: listener, speaker
- Firekeeper not implemented yet
- Most rules are phase-based, not role-based

**Simplification:**

```typescript
// Merge policy into phaseRules for now
// Defer policy/ folder until Firekeeper implementation
```

**New Structure:**

```typescript
// reducer/phaseRules.ts
export function canPerformAction(
  userId: string,
  actionType: string,
  tableState: TableState,
): boolean {
  const participant = tableState.participants.get(userId);
  if (!participant) return false;

  // Ghost users can only reconnect
  if (participant.presence === "GHOST") {
    return actionType === "RECONNECT";
  }

  // Phase-based rules
  if (tableState.phase === "SYNC_PAUSE") {
    return ["DISCONNECT", "SEND_GESTURE"].includes(actionType);
  }

  if (tableState.phase === "LIVE_SPEAKER" && actionType === "POINT_TO_USER") {
    return false; // Can't point during active speaking
  }

  return true;
}
```

**Savings:** 4 files removed from initial implementation.

---

#### **2. Action Schemas → Defer Validation**

**Current Spec:**

```typescript
// actions/actionSchemas.ts with Zod validation
```

**Reality:**

- Actions come from trusted client (same codebase)
- TypeScript provides compile-time validation
- Runtime validation adds complexity without benefit

**Simplification:**

```typescript
// Rely on TypeScript types only
// Add validation later if needed (e.g., if opening API to third parties)
```

**Savings:** 1 file, no Zod dependency in Slice 1.

---

#### **3. UI Templates Folder → Flatten**

**Current Spec:**

```typescript
ui / templates / speakerPanel.ts;
ui / templates / listenerPanel.ts;
ui / templates / pickerPanel.ts;
ui / templates / ghostPanel.ts;
```

**Reality:**

- Panel configs are simple objects
- No complex template logic needed
- Could be inline in `resolvePanelConfig.ts`

**Simplification:**

```typescript
// ui/resolvePanelConfig.ts (single file)
export function resolvePanelConfig(
  userId: string,
  tableState: TableState,
): PanelConfig {
  // All panel logic in one place
}
```

**Savings:** 4 files merged into 1.

---

#### **4. Adapter Event Names → Inline**

**Current Spec:**

```typescript
adapters / socketio / eventNames.ts;
```

**Reality:**

- Event names already defined in client constants
- No need for separate file

**Simplification:**

```typescript
// Use string literals directly
// Or import from client constants
```

**Savings:** 1 file removed.

---

### What Should Be Deferred?

| Feature            | Current Spec         | Defer Until                         |
| ------------------ | -------------------- | ----------------------------------- |
| Ghost TTL policy   | Placeholder in types | Post-Slice 1 (manual eject first)   |
| Firekeeper role    | Enum + policy hooks  | Post-Slice 2 (admin tools)          |
| Action replay      | Effect logging       | Post-production (debugging tools)   |
| Zod validation     | actionSchemas.ts     | API exposure or third-party clients |
| Horizontal scaling | Service split        | 1000+ concurrent rooms              |
| Event sourcing     | Persistence layer    | Audit requirements                  |

---

### Simplified File Count

**Original Plan:** 47 files  
**Simplified Plan:** 38 files

**Removed:**

- `policy/can.ts` → merged into `phaseRules.ts`
- `policy/rules/phaseRules.ts` → merged into `reducer/phaseRules.ts`
- `policy/rules/roleRules.ts` → deferred
- `policy/rules/presenceRules.ts` → deferred
- `actions/actionSchemas.ts` → deferred
- `ui/templates/` folder → merged into `resolvePanelConfig.ts`
- `adapters/socketio/eventNames.ts` → inline strings

**Result:** Leaner, faster initial implementation without sacrificing robustness.

---

## ✅ FINAL ARCHITECTURAL DECISIONS

### Additions to Spec

1. **Invariants 11-14:** Phase-to-speaker reverse constraints
2. **SYNC_PAUSE Freeze:** Hard reject pointer changes during lock
3. **Reconnect Snapshot:** `EMIT_FULL_STATE_TO_USER` effect type
4. **Room Cleanup Policy:** 30s grace period + orphan detection
5. **Migration Strategy:** NEW rooms use v2, existing stay on v1
6. **Delayed Action Guards:** Validate preconditions in each transition
7. **Pointer Cleanup:** Clear dangling pointers on explicit leave

### Simplifications

1. **Policy Engine:** Defer to post-Slice 1
2. **Action Validation:** Rely on TypeScript, defer Zod
3. **UI Templates:** Flatten into single file
4. **Event Names:** Use inline strings

### Risk Mitigations

1. **Cross-room contamination:** Protocol tests + invariant checks
2. **State desync:** Full snapshot on reconnect
3. **Memory leaks:** 24-hour force cleanup + orphan detection
4. **Delayed action failures:** Guard checks in every transition
5. **Dangling pointers:** Cleanup on leave + invariant enforcement

---

## 📝 ACTION ITEMS FOR SPEC UPDATE

**Update ENGINE_V2_COMPLETE_SPEC_AND_PLAN.md with:**

1. Add Invariants 11-14 (section 1.5)
2. Add SYNC_PAUSE freeze rule (section 2.2, new subsection)
3. Add `EMIT_FULL_STATE_TO_USER` effect (section 1.9)
4. Add Room Cleanup Policy section (new 1.13)
5. Update Migration Strategy (section 4.3)
6. Add Delayed Action Guards pattern (section 1.8)
7. Update file count: 47 → 38 files
8. Add "Deferred Features" appendix

**Remove from Day 1 implementation:**

- `policy/` folder
- `actions/actionSchemas.ts`
- `ui/templates/` folder (merge into single file)
- `adapters/socketio/eventNames.ts`

---

**END OF ARCHITECTURAL REFINEMENTS**

This analysis strengthens the spec without overcomplicating it. Ready for implementation. 🎯

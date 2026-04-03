# 🏗️ ENGINE V2: COMPLETE SPECIFICATION & IMPLEMENTATION PLAN

**Project:** SoulCircle MultiSession Engine  
**Version:** 2.0  
**Status:** Implementation Specification  
**Date:** February 21, 2026

---

## 📋 EXECUTIVE SUMMARY

**Mission:** Replace the current single-room global state architecture with a room-scoped, deterministic session orchestration engine that supports multiple concurrent sessions with ghost mode, stable identity, and proper isolation.

**Current State:** Single global session with `users`, `pointerMap`, `liveSpeaker`, `gliffMemory` as module-level variables. No room isolation. ~30 global broadcasts via `io.emit()`.

**Target State:** Room-scoped state in `RoomRegistry`, dispatch-based mutations, effects-based side effects, UI config projection, and full multi-room support.

**Migration Strategy:** Gradual cutover with adapter layer + per-room feature flag (`?engine=v2`).

---

# 1️⃣ SPECIFICATION

## 1.1 Mission Statement

The **MultiSessionStateServiceEngine** is the authoritative orchestrator of all active SoulCircle sessions.

### It Owns:

- All session state (`TableState` per room)
- Business logic enforcement
- Action validation and dispatch
- Room isolation
- Presence management (ghost mode)
- Consensus evaluation
- Speaker transitions

### It Does NOT:

- Render UI (that's client-side)
- Contain HTTP routes
- Make database calls directly
- Use global mutable variables

---

## 1.2 Core Concept: RoomRegistry

```typescript
RoomRegistry: Map<roomId: string, TableState>
```

**Rules:**

- Each room is completely isolated
- No shared mutable state between rooms
- All operations must be scoped by `roomId`
- Room lifecycle: create → active → cleanup

---

## 1.3 TableState (Single Source of Truth)

```typescript
interface TableState {
  // Identity
  sessionId: string;           // UUID for this session
  roomId: string;              // URL-based room identifier

  // Phase control
  phase: SessionPhase;

  // Participants (key = userId, not socketId)
  participants: Map<userId: string, ParticipantState>;

  // Attention mechanism
  pointerMap: Map<userId: string, targetUserId: string>;
  liveSpeaker: userId | null;
  syncPause: boolean;

  // Timer
  timer: SessionTimerState;

  // Lifecycle
  createdAt: number;           // Unix timestamp
  lastUpdated: number;
}
```

### 1.3.1 ParticipantState

```typescript
interface ParticipantState {
  // Identity (stable across reconnects)
  userId: string; // From authentication
  socketId: string | null; // Current connection (null when ghost)
  displayName: string; // UI name
  avatarId: string;

  // Role & permissions
  role: "listener" | "speaker" | "firekeeper";

  // Presence
  presence: "CONNECTED" | "GHOST" | "LEFT";

  // Attention
  attentionTarget: userId | null;

  // Timestamps
  joinedAt: number;
  lastSeen: number;
}
```

**Key Design Decisions:**

- `userId` is primary key (stable)
- `socketId` is presence only (changes on reconnect)
- Ghost users retain `userId` and avatar seat
- `LEFT` users are removed from participants Map

---

## 1.4 Session Phases

```typescript
type SessionPhase =
  | "LOBBY" // Pre-session, users joining
  | "ATTENTION_SELECTION" // Picker mode, deciding who speaks
  | "SYNC_PAUSE" // Brief freeze after consensus
  | "LIVE_SPEAKER" // Someone has the mic
  | "TRANSITION" // Between speakers
  | "ENDING" // Session timer expired, wrap-up
  | "ENDED"; // Session complete, cleanup
```

**Phase Transition Rules:**

```
LOBBY
  → (first user clicks "Ready to Glow")
  → ATTENTION_SELECTION

ATTENTION_SELECTION
  → (consensus achieved)
  → SYNC_PAUSE (2-3 seconds)
  → LIVE_SPEAKER

LIVE_SPEAKER
  → (speaker drops mic)
  → ATTENTION_SELECTION

  → (speaker passes mic via blue gesture → target accepts)
  → TRANSITION
  → LIVE_SPEAKER (new speaker)

  → (speaker disconnects)
  → ATTENTION_SELECTION

  → (timer expires)
  → ENDING

ENDING
  → (cleanup complete)
  → ENDED
```

---

## 1.5 Invariants (Non-Negotiable)

The engine MUST enforce these at all times:

1. **Single Live Speaker**  
   `liveSpeaker === null OR liveSpeaker exists in participants`

2. **Pointer Validity**  
   All keys in `pointerMap` exist in `participants`  
   All values in `pointerMap` exist in `participants`

3. **Ghost Exclusion from Consensus**  
   Only `CONNECTED` participants count toward required votes

4. **No Cross-Room State Leakage**  
   State mutation in Room A must not affect Room B

5. **Room-Scoped Emits Only**  
   No `io.emit()` allowed. Only `io.to(roomId).emit()`

6. **No Direct State Mutation**  
   All changes must go through `dispatch()`

7. **Phase Consistency**  
   `phase === LIVE_SPEAKER` ⇒ `liveSpeaker !== null`  
   `phase === SYNC_PAUSE` ⇒ `syncPause === true`

8. **Avatar Uniqueness per Room**  
   No two `CONNECTED` or `GHOST` users can have same avatarId in one room

9. **Speaker Must Be Connected**  
   `liveSpeaker !== null` ⇒ `participants[liveSpeaker].presence === CONNECTED`

10. **Session Cannot Deadlock**  
    If all users are `GHOST` → session transitions to `ENDING`

---

## 1.6 Ghost Mode Specification

### What is Ghost Mode?

When a user disconnects (network drop, browser close), they enter **Ghost Mode**:

- `presence = GHOST`
- `socketId = null`
- Avatar seat preserved
- Still visible in UI (grayed out)
- Excluded from consensus math
- Pointer preserved (visual freeze)

### Why Ghost Mode?

**Problem:** Network hiccups cause users to lose their seat and avatar.

**Solution:** Brief disconnects don't eject users. They can reconnect and resume.

### Ghost Transition Rules

**On Disconnect:**

```typescript
if (user.presence === CONNECTED) {
  user.presence = GHOST;
  user.socketId = null;
  user.lastSeen = Date.now();

  if (user.userId === liveSpeaker) {
    // Ghost speaker = drop mic
    liveSpeaker = null;
    phase = ATTENTION_SELECTION;
    emitSystemLog("Speaker disconnected. Returning to picker mode.");
  }
}
```

**On Reconnect:**

```typescript
if (user.presence === GHOST) {
  user.presence = CONNECTED;
  user.socketId = newSocketId;
  user.lastSeen = Date.now();

  // Resume current phase (no retroactive changes)
  // If consensus happened while ghost, user is now a listener
}
```

**Ghost Cleanup (Future):**

```typescript
// Not in Slice 1, but hooks exist
if (user.presence === GHOST && Date.now() - user.lastSeen > GHOST_TTL) {
  user.presence = LEFT;
  participants.delete(user.userId);
  releaseAvatar(user.avatarId);
}
```

---

## 1.7 Consensus & Attention Logic

### Consensus Rule

**Definition:** All `CONNECTED` participants point to the same target.

```typescript
function evaluateConsensus(tableState: TableState): userId | null {
  const connected = Array.from(tableState.participants.values()).filter(
    (p) => p.presence === "CONNECTED",
  );

  if (connected.length === 0) return null;

  const votes = new Map<userId, number>();

  for (const participant of connected) {
    const target = tableState.pointerMap.get(participant.userId);
    if (target) {
      votes.set(target, (votes.get(target) || 0) + 1);
    }
  }

  for (const [candidate, count] of votes.entries()) {
    if (count === connected.length) {
      return candidate; // Unanimous
    }
  }

  return null; // No consensus
}
```

**Key Decisions:**

- `GHOST` users do NOT count toward required votes
- Self-pointing is allowed (user can vote for themselves)
- Consensus requires 100% of `CONNECTED` users

---

## 1.8 Dispatch Model (Single Mutation Entry Point)

All state changes flow through:

```typescript
dispatch(roomId: string, userId: string, action: Action): Effect[]
```

**No other code may mutate `TableState`.**

### Action Structure

```typescript
interface Action {
  type: string;
  payload?: any;
}
```

**Examples:**

```typescript
{ type: "JOIN_SESSION", payload: { displayName, avatarId } }
{ type: "POINT_TO_USER", payload: { targetUserId } }
{ type: "CLICK_READY_TO_GLOW", payload: {} }
{ type: "DROP_MIC", payload: {} }
{ type: "SEND_GESTURE", payload: { gestureCode, emoji } }
{ type: "TEXT_INPUT", payload: { char } }
{ type: "DISCONNECT", payload: {} }
{ type: "RECONNECT", payload: { socketId } }
```

---

## 1.9 Effects Layer (Side Effects Isolation)

The reducer returns **effects**, not side effects.

```typescript
type Effect =
  | { type: "SOCKET_EMIT_ROOM"; roomId: string; event: string; data: any }
  | { type: "SOCKET_EMIT_USER"; userId: string; event: string; data: any }
  | { type: "GLIFF_APPEND"; roomId: string; entry: GliffMessage }
  | { type: "TIMER_START"; roomId: string; durationMs: number }
  | { type: "TIMER_CANCEL"; roomId: string }
  | { type: "SYSTEM_LOG"; roomId: string; message: string };
```

**Effect Execution:**

```typescript
function runEffects(effects: Effect[], io: Server) {
  for (const effect of effects) {
    switch (effect.type) {
      case "SOCKET_EMIT_ROOM":
        io.to(effect.roomId).emit(effect.event, effect.data);
        break;
      case "GLIFF_APPEND":
        gliffService.append(effect.roomId, effect.entry);
        break;
      // ... etc
    }
  }
}
```

**Why This Matters:**

- Reducer is pure → testable
- Effects are logged → auditable
- Can replay actions for debugging

---

## 1.10 Gliff Integration Boundary

### Current Problem

`gliffLogService.ts` has:

```typescript
const gliffMemory: GliffMessage[] = []; // ❌ Global
```

### V2 Design

**Gliff becomes an in-process service with room-scoped state:**

```typescript
// gliffService.ts (v2)
class GliffService {
  private logs = new Map<roomId: string, GliffMessage[]>();

  append(roomId: string, entry: GliffMessage) {
    if (!this.logs.has(roomId)) {
      this.logs.set(roomId, []);
    }
    const log = this.logs.get(roomId)!;
    // ... merging logic
    return log;
  }

  clear(roomId: string) {
    this.logs.delete(roomId);
  }
}
```

**Engine → Gliff Flow:**

```
1. Reducer emits effect: { type: "GLIFF_APPEND", roomId, entry }
2. Effect handler calls: gliffService.append(roomId, entry)
3. Gliff service returns updated log
4. Effect handler emits: io.to(roomId).emit("gliffLog:update", log)
```

**Gliff does NOT:**

- Trigger state transitions
- Call socket emits directly
- Store session state

---

## 1.11 UI Config Resolution (Projection)

UI panel configs are **derived from state**, never drivers of state.

```typescript
function resolvePanelConfig(
  userId: string,
  tableState: TableState,
): PanelConfig {
  const participant = tableState.participants.get(userId);
  if (!participant) return { type: "LOBBY_PANEL" };

  if (participant.presence === "GHOST") {
    return { type: "GHOST_PANEL", message: "Reconnecting..." };
  }

  switch (tableState.phase) {
    case "ATTENTION_SELECTION":
      return buildPickerPanel(userId, tableState);
    case "LIVE_SPEAKER":
      if (tableState.liveSpeaker === userId) {
        return buildSpeakerPanel(userId, tableState);
      } else {
        return buildListenerPanel(userId, tableState);
      }
    // ... etc
  }
}
```

**Panel config generation is:**

- Pure function
- No side effects
- Testable in isolation
- Called AFTER state mutations

---

## 1.12 Firekeeper (Future-Ready Hooks)

**Role Reserved:**

```typescript
role: "listener" | "speaker" | "firekeeper";
```

**Policy Engine:**

```typescript
function can(
  userId: string,
  actionType: string,
  tableState: TableState,
): boolean {
  const participant = tableState.participants.get(userId);
  if (!participant) return false;

  if (participant.role === "firekeeper") {
    // Firekeeper can override phase restrictions (future)
    return true;
  }

  // Phase-based rules
  if (
    tableState.phase === "LIVE_SPEAKER" &&
    actionType === "CLICK_READY_TO_GLOW"
  ) {
    return false; // Can't request mic during active speaking
  }

  // ... more rules
}
```

**Not Implemented in Slice 1:**

- Firekeeper UI
- Firekeeper permissions
- Manual ghost ejection

**But infrastructure exists for later.**

---

# 2️⃣ FILE STRUCTURE

## 2.1 Folder Layout

```
soulcircle-server/
├── server/
│   ├── engine-v2/                    # ← NEW
│   │   ├── index.ts                  # Public API
│   │   ├── README.md
│   │   │
│   │   ├── registry/
│   │   │   ├── RoomRegistry.ts       # Map<roomId, TableState>
│   │   │   └── RoomLifecycle.ts      # Create/destroy/cleanup
│   │   │
│   │   ├── state/
│   │   │   ├── types.ts              # TableState, ParticipantState, etc.
│   │   │   ├── defaults.ts           # Initial state factories
│   │   │   ├── invariants.ts         # assertInvariants()
│   │   │   └── selectors.ts          # Helper getters
│   │   │
│   │   ├── actions/
│   │   │   ├── actionTypes.ts        # String constants
│   │   │   ├── actionSchemas.ts      # Validation
│   │   │   └── normalizeAction.ts    # Legacy → canonical
│   │   │
│   │   ├── reducer/
│   │   │   ├── dispatch.ts           # Public entry point
│   │   │   ├── reducer.ts            # Central router
│   │   │   └── transitions/          # ← One file per action
│   │   │       ├── join.ts
│   │   │       ├── disconnect.ts
│   │   │       ├── reconnect.ts
│   │   │       ├── pointToUser.ts
│   │   │       ├── evaluateSync.ts
│   │   │       ├── setLiveSpeaker.ts
│   │   │       ├── syncPause.ts
│   │   │       ├── dropMic.ts
│   │   │       ├── passMic.ts
│   │   │       ├── sendGesture.ts
│   │   │       ├── textInput.ts
│   │   │       └── endSession.ts
│   │   │
│   │   ├── policy/
│   │   │   ├── can.ts                # Permission check
│   │   │   └── rules/
│   │   │       ├── phaseRules.ts
│   │   │       ├── roleRules.ts
│   │   │       └── presenceRules.ts
│   │   │
│   │   ├── effects/
│   │   │   ├── effectTypes.ts
│   │   │   ├── runEffects.ts
│   │   │   ├── socketEffects.ts      # Room-scoped emits
│   │   │   ├── timerEffects.ts
│   │   │   └── gliffEffects.ts
│   │   │
│   │   ├── ui/
│   │   │   ├── resolvePanelConfig.ts
│   │   │   └── templates/
│   │   │       ├── baseTemplates.ts
│   │   │       ├── speakerPanel.ts
│   │   │       ├── listenerPanel.ts
│   │   │       ├── pickerPanel.ts
│   │   │       └── ghostPanel.ts
│   │   │
│   │   ├── adapters/
│   │   │   └── socketio/
│   │   │       ├── bindSocketHandlers.ts
│   │   │       ├── clientEmitsAdapter.ts
│   │   │       ├── emitToRoom.ts
│   │   │       ├── emitToUser.ts
│   │   │       └── eventNames.ts
│   │   │
│   │   └── tests/
│   │       └── protocol/
│   │           ├── consensus.test.ts
│   │           ├── ghostSpeakerDrop.test.ts
│   │           ├── lateJoinMidPointing.test.ts
│   │           ├── disconnectDuringSyncPause.test.ts
│   │           ├── pointerChangeBeforeLock.test.ts
│   │           ├── reconnectRestore.test.ts
│   │           └── roomIsolation.test.ts
│   │
│   ├── gliffService.ts               # ← REFACTOR (add room scoping)
│   ├── socketHandler.ts              # ← BECOMES THIN ADAPTER
│   ├── actions/                      # ← LEGACY (gradually migrate)
│   ├── BL/                           # ← LEGACY
│   └── ...
```

---

## 2.2 Module Responsibilities

### `registry/`

**RoomRegistry.ts**

- `getRoom(roomId): TableState | undefined`
- `createRoom(roomId): TableState`
- `destroyRoom(roomId): void`
- `listRooms(): string[]`

**RoomLifecycle.ts**

- Session start/end logic
- Timer management (via effects)
- Cleanup policies

---

### `state/`

**types.ts**

- `TableState` interface
- `ParticipantState` interface
- `SessionPhase` enum
- `Presence` enum
- `Effect` union type

**defaults.ts**

```typescript
export function createInitialTableState(roomId: string): TableState {
  return {
    sessionId: generateUUID(),
    roomId,
    phase: "LOBBY",
    participants: new Map(),
    pointerMap: new Map(),
    liveSpeaker: null,
    syncPause: false,
    timer: { active: false, startTime: 0, durationMs: 3600000 },
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };
}
```

**invariants.ts**

```typescript
export function assertInvariants(tableState: TableState) {
  // Invariant 1: Single live speaker
  if (
    tableState.liveSpeaker &&
    !tableState.participants.has(tableState.liveSpeaker)
  ) {
    throw new Error("Invariant violation: liveSpeaker not in participants");
  }

  // ... all 10 invariants
}
```

**selectors.ts**

```typescript
export function getConnectedParticipants(
  tableState: TableState,
): ParticipantState[] {
  return Array.from(tableState.participants.values()).filter(
    (p) => p.presence === "CONNECTED",
  );
}

export function getLiveSpeaker(
  tableState: TableState,
): ParticipantState | null {
  if (!tableState.liveSpeaker) return null;
  return tableState.participants.get(tableState.liveSpeaker) || null;
}
```

---

### `actions/`

**actionTypes.ts**

```typescript
export const JOIN_SESSION = "JOIN_SESSION";
export const DISCONNECT = "DISCONNECT";
export const RECONNECT = "RECONNECT";
export const POINT_TO_USER = "POINT_TO_USER";
export const CLICK_READY_TO_GLOW = "CLICK_READY_TO_GLOW";
// ... etc
```

**actionSchemas.ts**

```typescript
import { z } from "zod";

export const joinSessionSchema = z.object({
  displayName: z.string().min(1).max(50),
  avatarId: z.string(),
});

export function validateAction(actionType: string, payload: any) {
  switch (actionType) {
    case JOIN_SESSION:
      return joinSessionSchema.parse(payload);
    // ... etc
  }
}
```

---

### `reducer/`

**dispatch.ts** (Public API)

```typescript
export function dispatch(
  roomId: string,
  userId: string,
  action: Action,
): Effect[] {
  const room = roomRegistry.getRoom(roomId);
  if (!room) {
    return [{ type: "SYSTEM_LOG", roomId, message: "Room not found" }];
  }

  // Permission check
  if (!can(userId, action.type, room)) {
    return [
      { type: "SOCKET_EMIT_USER", userId, event: "action-rejected", data: {} },
    ];
  }

  // Dispatch to reducer
  const effects = reducer(room, userId, action);

  // Invariant check (dev mode)
  if (process.env.NODE_ENV !== "production") {
    assertInvariants(room);
  }

  return effects;
}
```

**reducer.ts** (Router)

```typescript
import * as transitions from "./transitions";

export function reducer(
  tableState: TableState,
  userId: string,
  action: Action,
): Effect[] {
  switch (action.type) {
    case "JOIN_SESSION":
      return transitions.join(tableState, userId, action.payload);
    case "DISCONNECT":
      return transitions.disconnect(tableState, userId);
    case "POINT_TO_USER":
      return transitions.pointToUser(tableState, userId, action.payload);
    // ... etc
    default:
      return [
        {
          type: "SYSTEM_LOG",
          roomId: tableState.roomId,
          message: `Unknown action: ${action.type}`,
        },
      ];
  }
}
```

---

### `reducer/transitions/` (Examples)

**join.ts**

```typescript
export function join(
  tableState: TableState,
  userId: string,
  payload: { displayName: string; avatarId: string },
): Effect[] {
  const effects: Effect[] = [];

  // Check avatar availability
  const avatarTaken = Array.from(tableState.participants.values()).some(
    (p) => p.avatarId === payload.avatarId && p.presence !== "LEFT",
  );

  if (avatarTaken) {
    effects.push({
      type: "SOCKET_EMIT_USER",
      userId,
      event: "join-rejected",
      data: { reason: "Avatar already taken" },
    });
    return effects;
  }

  // Add participant
  tableState.participants.set(userId, {
    userId,
    socketId: null, // Will be set by reconnect or adapter
    displayName: payload.displayName,
    avatarId: payload.avatarId,
    role: "listener",
    presence: "CONNECTED",
    attentionTarget: null,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
  });

  // Start session if first user
  if (tableState.participants.size === 1) {
    tableState.phase = "LOBBY";
    effects.push({
      type: "TIMER_START",
      roomId: tableState.roomId,
      durationMs: 3600000, // 60 minutes
    });
  }

  // Emit updates
  effects.push({
    type: "SOCKET_EMIT_ROOM",
    roomId: tableState.roomId,
    event: "user-list",
    data: serializeParticipants(tableState),
  });

  return effects;
}
```

**disconnect.ts**

```typescript
export function disconnect(tableState: TableState, userId: string): Effect[] {
  const effects: Effect[] = [];
  const participant = tableState.participants.get(userId);

  if (!participant) return effects;

  // Set to ghost
  participant.presence = "GHOST";
  participant.socketId = null;
  participant.lastSeen = Date.now();

  // If ghost was live speaker, drop mic
  if (tableState.liveSpeaker === userId) {
    tableState.liveSpeaker = null;
    tableState.phase = "ATTENTION_SELECTION";

    effects.push({
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: `${participant.displayName} disconnected (was speaking). Returning to picker mode.`,
    });
  }

  // Re-evaluate consensus (ghost excluded)
  const consensusEffects = evaluateSync(tableState);
  effects.push(...consensusEffects);

  // Emit updates
  effects.push({
    type: "SOCKET_EMIT_ROOM",
    roomId: tableState.roomId,
    event: "user-list",
    data: serializeParticipants(tableState),
  });

  return effects;
}
```

**pointToUser.ts**

```typescript
export function pointToUser(
  tableState: TableState,
  userId: string,
  payload: { targetUserId: string },
): Effect[] {
  const effects: Effect[] = [];

  // Update pointer
  tableState.pointerMap.set(userId, payload.targetUserId);

  // Evaluate consensus
  const consensusEffects = evaluateSync(tableState);
  effects.push(...consensusEffects);

  // Emit pointer update
  effects.push({
    type: "SOCKET_EMIT_ROOM",
    roomId: tableState.roomId,
    event: "update-pointing",
    data: { from: userId, to: payload.targetUserId },
  });

  return effects;
}
```

**evaluateSync.ts**

```typescript
export function evaluateSync(tableState: TableState): Effect[] {
  const effects: Effect[] = [];

  if (tableState.phase !== "ATTENTION_SELECTION") {
    return effects; // Only evaluate during picker mode
  }

  const consensus = evaluateConsensus(tableState);

  if (consensus) {
    // Consensus achieved!
    tableState.phase = "SYNC_PAUSE";
    tableState.syncPause = true;

    effects.push({
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: `Consensus achieved on ${consensus}`,
    });

    // Set live speaker after 2 seconds
    effects.push({
      type: "DELAYED_ACTION",
      delayMs: 2000,
      action: { type: "SET_LIVE_SPEAKER", payload: { userId: consensus } },
    });
  }

  return effects;
}
```

---

### `policy/`

**can.ts**

```typescript
export function can(
  userId: string,
  actionType: string,
  tableState: TableState,
): boolean {
  const participant = tableState.participants.get(userId);
  if (!participant) return false;

  // Ghost users cannot act
  if (participant.presence === "GHOST") {
    return actionType === "RECONNECT";
  }

  // Firekeeper overrides (future)
  if (participant.role === "firekeeper") {
    return true;
  }

  // Phase-based rules
  return checkPhaseRules(actionType, tableState.phase);
}
```

---

### `effects/`

**runEffects.ts**

```typescript
export function runEffects(
  effects: Effect[],
  io: Server,
  roomRegistry: RoomRegistry,
) {
  for (const effect of effects) {
    try {
      switch (effect.type) {
        case "SOCKET_EMIT_ROOM":
          io.to(effect.roomId).emit(effect.event, effect.data);
          break;
        case "SOCKET_EMIT_USER":
          const participant = findParticipantByUserId(
            effect.userId,
            roomRegistry,
          );
          if (participant?.socketId) {
            io.to(participant.socketId).emit(effect.event, effect.data);
          }
          break;
        case "GLIFF_APPEND":
          const log = gliffService.append(effect.roomId, effect.entry);
          io.to(effect.roomId).emit("gliffLog:update", log);
          break;
        case "TIMER_START":
          timerService.start(effect.roomId, effect.durationMs);
          break;
        // ... etc
      }
    } catch (error) {
      console.error("Effect execution failed:", error);
    }
  }
}
```

---

### `ui/`

**resolvePanelConfig.ts**

```typescript
export function resolvePanelConfig(
  userId: string,
  tableState: TableState,
): PanelConfig {
  const participant = tableState.participants.get(userId);
  if (!participant) return lobbyPanel();

  if (participant.presence === "GHOST") {
    return ghostPanel(participant.displayName);
  }

  switch (tableState.phase) {
    case "LOBBY":
      return lobbyPanel();
    case "ATTENTION_SELECTION":
      return pickerPanel(userId, tableState);
    case "LIVE_SPEAKER":
      if (tableState.liveSpeaker === userId) {
        return speakerPanel(userId, tableState);
      } else {
        return listenerPanel(userId, tableState);
      }
    case "ENDING":
      return endingPanel();
    default:
      return lobbyPanel();
  }
}
```

---

### `adapters/socketio/`

**clientEmitsAdapter.ts** (Thin adapter over legacy)

```typescript
export function adaptClientEmits(
  payload: any,
  socket: Socket,
  roomRegistry: RoomRegistry,
  io: Server,
) {
  const userId = socket.data.userId;
  const roomId = socket.data.roomId;

  // Check feature flag
  const useV2 = socket.data.engineVersion === "v2";

  if (useV2) {
    // Normalize legacy payload to v2 action
    const action = normalizeAction(payload);

    // Dispatch
    const effects = dispatch(roomId, userId, action);

    // Run effects
    runEffects(effects, io, roomRegistry);
  } else {
    // Route to legacy handler
    legacyRouteAction(payload, { io, socket /* ... */ });
  }
}
```

---

# 3️⃣ IMPLEMENTATION PLAN

## 3.1 Phase 1: Foundation (Week 1)

### Day 1-2: State & Registry

**Tasks:**

- [ ] Create `engine-v2/` folder structure
- [ ] Implement `state/types.ts` (all interfaces)
- [ ] Implement `state/defaults.ts` (factory functions)
- [ ] Implement `state/invariants.ts` (10 assertions)
- [ ] Implement `state/selectors.ts` (helpers)
- [ ] Implement `registry/RoomRegistry.ts`
- [ ] Write tests: `roomRegistry.test.ts`

**Deliverable:** Can create and retrieve room state.

---

### Day 3-4: Actions & Dispatch

**Tasks:**

- [ ] Implement `actions/actionTypes.ts`
- [ ] Implement `actions/actionSchemas.ts` (with Zod)
- [ ] Implement `actions/normalizeAction.ts`
- [ ] Implement `reducer/dispatch.ts` (entry point)
- [ ] Implement `reducer/reducer.ts` (router)
- [ ] Implement `policy/can.ts` (stub allow-all)
- [ ] Write tests: `dispatch.test.ts`

**Deliverable:** Can dispatch actions (even if reducers are stubs).

---

### Day 5: Effects Layer

**Tasks:**

- [ ] Implement `effects/effectTypes.ts`
- [ ] Implement `effects/runEffects.ts`
- [ ] Implement `effects/socketEffects.ts`
- [ ] Implement `adapters/socketio/emitToRoom.ts`
- [ ] Implement `adapters/socketio/emitToUser.ts`
- [ ] Write tests: `effects.test.ts`

**Deliverable:** Can execute effects safely.

---

## 3.2 Phase 2: Slice 1 - Core Session Flow (Week 2)

### Day 6-7: Join / Reconnect / Ghost

**Tasks:**

- [ ] Implement `transitions/join.ts`
- [ ] Implement `transitions/disconnect.ts` (ghost mode)
- [ ] Implement `transitions/reconnect.ts` (ghost → connected)
- [ ] Write tests:
  - [ ] `join.test.ts` (avatar conflict, first user, late join)
  - [ ] `disconnect.test.ts` (speaker ghost, listener ghost)
  - [ ] `reconnect.test.ts` (restore identity, resume phase)
  - [ ] `ghostSpeakerDrop.test.ts` (protocol test)

**Deliverable:** Users can join, disconnect (ghost), and reconnect.

---

### Day 8-9: Pointer & Consensus

**Tasks:**

- [ ] Implement `transitions/pointToUser.ts`
- [ ] Implement `transitions/evaluateSync.ts` (consensus logic)
- [ ] Implement `transitions/setLiveSpeaker.ts`
- [ ] Implement `transitions/syncPause.ts`
- [ ] Write tests:
  - [ ] `pointToUser.test.ts` (pointer updates, invalid targets)
  - [ ] `consensus.test.ts` (all scenarios: 2 users, 5 users, ghost excluded)
  - [ ] `lateJoinMidPointing.test.ts` (protocol test)
  - [ ] `pointerChangeBeforeLock.test.ts` (protocol test)

**Deliverable:** Consensus evaluation works, speaker transitions.

---

### Day 10: Room Isolation

**Tasks:**

- [ ] Refactor `gliffService.ts` → room-scoped
- [ ] Implement `gliffEffects.ts`
- [ ] Test with 2 rooms simultaneously
- [ ] Write tests:
  - [ ] `roomIsolation.test.ts` (Room A actions don't affect Room B)
  - [ ] `gliffRoomScoping.test.ts` (Gliff logs isolated)

**Deliverable:** 4 parallel rooms work without cross-contamination.

---

## 3.3 Phase 3: Adapter & Feature Flag (Week 3)

### Day 11-12: Socket Adapter

**Tasks:**

- [ ] Implement `adapters/socketio/bindSocketHandlers.ts`
- [ ] Implement `adapters/socketio/clientEmitsAdapter.ts`
- [ ] Add feature flag: `socket.data.engineVersion = "v2"`
- [ ] Route based on flag: v1 vs v2
- [ ] Test dual-engine mode (v1 and v2 side-by-side)

**Deliverable:** Can toggle v2 per room via URL param `?engine=v2`.

---

### Day 13: UI Config Projection

**Tasks:**

- [ ] Implement `ui/resolvePanelConfig.ts`
- [ ] Implement `ui/templates/pickerPanel.ts`
- [ ] Implement `ui/templates/speakerPanel.ts`
- [ ] Implement `ui/templates/listenerPanel.ts`
- [ ] Implement `ui/templates/ghostPanel.ts`
- [ ] Wire up panel emission in effects
- [ ] Test: Panel configs match expected shape

**Deliverable:** UI panels render correctly from v2 state.

---

### Day 14: Integration Testing

**Tasks:**

- [ ] End-to-end test: Join → Point → Consensus → Speaker → Disconnect → Reconnect
- [ ] Load test: 4 rooms, 5 users each, 30 actions/user
- [ ] Stability test: Run for 10 minutes without errors
- [ ] Protocol tests: All 7 scenarios pass

**Deliverable:** Slice 1 is stable and tested.

---

## 3.4 Phase 4: Remaining Actions (Week 4)

**Tasks:**

- [ ] Implement `transitions/dropMic.ts`
- [ ] Implement `transitions/passMic.ts` (blue gesture)
- [ ] Implement `transitions/sendGesture.ts`
- [ ] Implement `transitions/textInput.ts`
- [ ] Implement `transitions/endSession.ts`
- [ ] Write tests for each transition
- [ ] Migrate remaining legacy actions to v2

**Deliverable:** Full feature parity with v1.

---

## 3.5 Phase 5: Cutover (Week 5)

**Tasks:**

- [ ] Set `engine=v2` as default
- [ ] Monitor production for 3 days
- [ ] Fix any edge cases discovered
- [ ] Remove feature flag
- [ ] Delete legacy `socketHandler.ts` code
- [ ] Update documentation

**Deliverable:** V2 is production default. V1 deleted.

---

# 4️⃣ INTEGRATION STRATEGY

## 4.1 Current Legacy Modules

### Global State Locations

| File                 | Global Variables               | Line | Impact                         |
| -------------------- | ------------------------------ | ---- | ------------------------------ |
| `socketHandler.ts`   | `const users = new Map()`      | 42   | ❌ HIGH - All user data        |
| `socketHandler.ts`   | `const pointerMap = new Map()` | 89   | ❌ HIGH - Consensus logic      |
| `socketHandler.ts`   | `let liveSpeaker`              | 90   | ❌ HIGH - Speaker state        |
| `socketHandler.ts`   | `let sessionActive`            | 48   | ❌ MEDIUM - Session flag       |
| `gliffLogService.ts` | `const gliffMemory = []`       | 14   | ❌ CRITICAL - Cross-room bleed |
| `BL/sessionLogic.ts` | `const users = new Map()`      | 20   | ❌ HIGH - Duplicate!           |

**Total Global State Containers:** 6

---

### Broadcast Locations

**30+ instances of `io.emit()` in `socketHandler.ts`:**

| Line | Event                       | Scope     |
| ---- | --------------------------- | --------- |
| 185  | `user-list`                 | ❌ Global |
| 189  | `avatars`                   | ❌ Global |
| 221  | `session-started-broadcast` | ❌ Global |
| 264  | `session-ended`             | ❌ Global |
| 317  | `session-timer`             | ❌ Global |
| ...  | ...                         | ...       |

**Must become:** `io.to(roomId).emit(...)`

---

## 4.2 Migration Sequence

### Slice 1 Actions (Week 2)

**Migrate First:**

1. `JOIN_SESSION` → `transitions/join.ts`
2. `DISCONNECT` → `transitions/disconnect.ts`
3. `RECONNECT` → `transitions/reconnect.ts`
4. `POINT_TO_USER` → `transitions/pointToUser.ts`
5. Consensus evaluation → `transitions/evaluateSync.ts`

**Why These First?**

- Core session lifecycle
- Most critical for multi-room support
- Simplest logic (no complex blue gestures yet)

---

### Slice 2 Actions (Week 4)

**Migrate Next:**

1. `DROP_MIC` → `transitions/dropMic.ts`
2. `PASS_MIC` → `transitions/passMic.ts`
3. `SEND_GESTURE` → `transitions/sendGesture.ts`
4. `TEXT_INPUT` → `transitions/textInput.ts`

**Why These Second?**

- Build on Slice 1 foundation
- More complex state transitions
- Blue gesture system needs speaker state working

---

### Slice 3 Actions (Week 5)

**Migrate Last:**

1. Session picker logic
2. Timer end actions
3. Avatar release
4. Admin/debug routes

**Why These Last?**

- Least critical for core protocol
- Can coexist with v1 longer
- Edge cases, rarely used

---

## 4.3 Feature Flag Mechanism

### URL-Based Toggle

**V1 (Legacy):**

```
https://soulcircle.app/room/abc123
```

**V2 (New Engine):**

```
https://soulcircle.app/room/abc123?engine=v2
```

### Server Detection

```typescript
socket.on("request-join", ({ name, avatarId, roomId, engineVersion }) => {
  socket.data.roomId = roomId;
  socket.data.engineVersion = engineVersion || "v1"; // Default v1

  if (engineVersion === "v2") {
    // Route to v2
    const action = {
      type: "JOIN_SESSION",
      payload: { displayName: name, avatarId },
    };
    const effects = dispatch(roomId, generateUserId(), action);
    runEffects(effects, io, roomRegistry);
  } else {
    // Route to v1 (legacy)
    legacyJoinHandler(socket, name, avatarId);
  }
});
```

### Client-Side

```typescript
// React: Parse URL param
const searchParams = new URLSearchParams(window.location.search);
const engineVersion = searchParams.get("engine") || "v1";

// Send on join
socket.emit("request-join", {
  name,
  avatarId,
  roomId,
  engineVersion,
});
```

---

## 4.4 Dual-Engine Coexistence

### Isolation Rules

**V1 Rooms:**

- Use global `users`, `pointerMap`, `liveSpeaker`
- Use `io.emit()` (broadcast to all)
- Gliff uses global `gliffMemory`

**V2 Rooms:**

- Use `roomRegistry.getRoom(roomId)`
- Use `io.to(roomId).emit()` (scoped)
- Gliff uses `gliffService.get(roomId)`

**No Shared State Between V1 and V2.**

### Gradual Rollout

**Week 1:** Internal testing only (`?engine=v2`)  
**Week 2:** Beta users opt-in  
**Week 3:** 10% of rooms auto-assigned to v2  
**Week 4:** 50% of rooms  
**Week 5:** 100% cutover, v1 deleted

---

# 5️⃣ RISK MATRIX

## 5.1 Top Migration Risks

| Risk                                 | Severity    | Probability | Mitigation                             |
| ------------------------------------ | ----------- | ----------- | -------------------------------------- |
| **Cross-room contamination in v2**   | 🔴 Critical | Low         | Comprehensive `roomIsolation.test.ts`  |
| **State desync during cutover**      | 🔴 Critical | Medium      | Feature flag allows rollback           |
| **Ghost users breaking consensus**   | 🟠 High     | Medium      | Protocol tests + invariant checks      |
| **Gliff refactor introduces bugs**   | 🟠 High     | Medium      | Keep v1 gliff, add v2 in parallel      |
| **Socket reconnect identity loss**   | 🟠 High     | Low         | Use `userId` from auth, not `socketId` |
| **Performance regression**           | 🟡 Medium   | Low         | Load tests before cutover              |
| **UI panel config breaking changes** | 🟡 Medium   | Medium      | Keep panel shape backward-compatible   |
| **Timer service memory leaks**       | 🟡 Medium   | Low         | Proper cleanup on room destroy         |

---

## 5.2 Mitigation Strategies

### For Cross-Room Contamination

**Prevention:**

- No global variables in v2
- All state in `RoomRegistry`
- All emits use `io.to(roomId)`
- `roomIsolation.test.ts` runs on every commit

**Detection:**

- Add room ID to every log
- Monitor for "wrong room" errors
- Alert on cross-room state access

---

### For State Desync

**Prevention:**

- Feature flag allows instant rollback
- V1 and V2 never share state
- Clear migration boundaries

**Detection:**

- Compare v1 vs v2 outcomes in tests
- Run dual-engine mode in staging
- Monitor for invariant violations

---

### For Ghost Mode Bugs

**Prevention:**

- Comprehensive protocol tests
- Ghost exclusion from consensus math
- Clear presence state transitions

**Detection:**

- Invariant: `liveSpeaker` must be `CONNECTED`
- Alert if ghost becomes speaker
- Log all presence transitions

---

# 6️⃣ TESTING CHECKLIST

## 6.1 Protocol Tests (Required Before Cutover)

### Consensus

- [ ] **2 users, both point to User A** → User A becomes speaker
- [ ] **3 users, 2 point to A, 1 to B** → No consensus
- [ ] **5 users, all point to same target** → Consensus achieved
- [ ] **Ghost user exists, consensus ignores ghost** → Consensus with 3/4 connected users
- [ ] **Pointer change before lock** → Consensus recalculated

### Ghost Mode

- [ ] **Speaker disconnects** → liveSpeaker cleared, phase = ATTENTION_SELECTION
- [ ] **Listener disconnects** → becomes ghost, excluded from consensus
- [ ] **Ghost reconnects** → presence = CONNECTED, resumes current phase
- [ ] **Ghost was mid-pointing** → pointer preserved, but doesn't count toward consensus
- [ ] **All users disconnect** → session transitions to ENDING

### Late Join

- [ ] **User joins during ATTENTION_SELECTION** → no auto-pointer, sees current state
- [ ] **User joins during LIVE_SPEAKER** → sees speaker panel, excluded from consensus
- [ ] **User joins during SYNC_PAUSE** → waits for phase to resolve

### Disconnect Edge Cases

- [ ] **Disconnect during syncPause** → ghost, syncPause completes normally
- [ ] **Disconnect while passing mic (blue gesture)** → offer cancelled
- [ ] **Last user disconnects** → session cleanup triggers

### Room Isolation

- [ ] **Room A: user joins** → Room B state unchanged
- [ ] **Room A: pointer updated** → Room B pointerMap untouched
- [ ] **Room A: gliff message** → Room B gliff log unchanged
- [ ] **4 rooms simultaneously** → no cross-contamination

---

## 6.2 Integration Tests

- [ ] **Full session flow** (join → point → speaker → gesture → disconnect → reconnect)
- [ ] **Blue gesture acceptance** (speaker passes mic → target accepts → becomes speaker)
- [ ] **Blue gesture rejection** (speaker passes mic → target declines → speaker continues)
- [ ] **Timer expiration** (session ends after 60 minutes)
- [ ] **Avatar conflict** (second user tries same avatar → rejected)

---

## 6.3 Load Tests

- [ ] **4 rooms, 5 users each** → stable for 10 minutes
- [ ] **50 actions/user in 1 minute** → no dropped events
- [ ] **Rapid pointer changes (10/sec)** → consensus still accurate
- [ ] **Gliff log at 20 messages** → FIFO eviction works

---

## 6.4 Stability Tests

- [ ] **Run for 1 hour** → no memory leaks
- [ ] **Run for 1 hour** → no invariant violations
- [ ] **10 sequential sessions in one room** → proper cleanup between sessions

---

# 7️⃣ ASSUMPTIONS

## 7.1 Locked Assumptions (Do Not Change Without Discussion)

1. **Migration Approach:** Gradual cutover with adapter + room-level feature flag (`?engine=v2`)

2. **Room ID Source:** URL path `/room/:roomId`, sent by client on join

3. **Identity Model:**
   - `userId` = stable identifier from authentication
   - `socketId` = transient connection ID
   - Primary key in v2 is `userId`, not `socketId`

4. **Ghost Mode:**
   - Default behavior on disconnect
   - TTL policy deferred (not in Slice 1)
   - Ghost users excluded from consensus math

5. **Gliff Boundary:**
   - In-process service with room-scoped state
   - Event-driven effects pattern
   - Service split to separate process is future work

6. **Firekeeper:**
   - Role reserved in types
   - Policy hooks exist
   - No implementation in Slice 1

---

## 7.2 Alternative Assumptions (Consider If Needed)

### Alternative A: Room ID from Server

**Instead of client-supplied `roomId`:**

- Server auto-assigns rooms (matchmaking)
- Client receives `roomId` after join

**Pros:** Simpler client, prevents room ID collisions  
**Cons:** More complex routing, URL doesn't work as permalink

---

### Alternative B: Immediate Ghost Ejection

**Instead of ghost preservation:**

- Disconnect = instant removal from session
- No ghost mode at all

**Pros:** Simpler logic, no ghost edge cases  
**Cons:** Poor UX for network hiccups, avatar seat lost

---

### Alternative C: Big-Bang Migration

**Instead of gradual cutover:**

- Build v2 completely in parallel
- Hard switch on launch day

**Pros:** Cleaner cut, no dual-engine complexity  
**Cons:** Higher risk, harder to rollback

---

# 8️⃣ SUCCESS CRITERIA

## 8.1 Slice 1 Complete When:

- [ ] Users can join 4+ rooms simultaneously
- [ ] Pointer consensus works in all rooms
- [ ] Ghost mode handles disconnects gracefully
- [ ] Gliff logs are isolated per room
- [ ] All 7 protocol tests pass
- [ ] No cross-room contamination observed
- [ ] No global state variables in v2 code
- [ ] Feature flag toggles v1/v2 per room

---

## 8.2 V2 Production-Ready When:

- [ ] All actions migrated from v1
- [ ] UI panels render correctly from v2 state
- [ ] Load tests pass (4 rooms, 5 users each, 10 minutes)
- [ ] Stability tests pass (1 hour runtime, no leaks)
- [ ] Beta users report no regressions
- [ ] Documentation updated
- [ ] Rollback plan tested

---

## 8.3 V1 Deletion Allowed When:

- [ ] V2 runs in production for 2 weeks
- [ ] Zero P0 bugs reported
- [ ] Performance metrics stable
- [ ] All v1 code paths unused (confirmed via logging)

---

# 9️⃣ NEXT STEPS

## Immediate Actions (This Week)

1. **Create folder structure** (`engine-v2/` with all subdirectories)
2. **Implement `state/types.ts`** (all interfaces)
3. **Implement `registry/RoomRegistry.ts`** (basic CRUD)
4. **Write first test** (`roomRegistry.test.ts`)

## Week 1 Goal

**Deliverable:** Can create a room, store state, and dispatch a no-op action.

**Validation:** `dispatch(roomId, userId, { type: "NO_OP" })` returns empty effects array without errors.

---

# 🎯 FINAL NOTES

## Why This Will Work

1. **Room isolation is non-negotiable** → fixes the #1 bug
2. **Dispatch pattern is testable** → builds confidence
3. **Gradual migration reduces risk** → can rollback anytime
4. **Ghost mode improves UX** → users don't lose seats on hiccup
5. **Effects layer is auditable** → can replay actions for debugging

## Why This Won't Overengineer

1. **No premature optimization** → firekeeper is placeholder only
2. **No service splitting yet** → gliff stays in-process
3. **No persistence layer yet** → state still in-memory
4. **No queue system yet** → effects run synchronously

## What This Enables Later

1. **Horizontal scaling** → rooms can live on different servers
2. **Event sourcing** → effects log = audit trail
3. **Time travel debugging** → replay action sequence
4. **A/B testing** → run multiple engine versions
5. **Firekeeper role** → infrastructure ready

---

**This is not a rewrite. This is an architectural consolidation.**

The protocol you built is good. The implementation just needs room scoping.

This plan makes that happen without breaking existing functionality.

---

**END OF SPECIFICATION**

---

## 📎 APPENDIX

### A. File Checklist (All Files to Create)

```
[ ] engine-v2/index.ts
[ ] engine-v2/README.md
[ ] registry/RoomRegistry.ts
[ ] registry/RoomLifecycle.ts
[ ] state/types.ts
[ ] state/defaults.ts
[ ] state/invariants.ts
[ ] state/selectors.ts
[ ] actions/actionTypes.ts
[ ] actions/actionSchemas.ts
[ ] actions/normalizeAction.ts
[ ] reducer/dispatch.ts
[ ] reducer/reducer.ts
[ ] reducer/transitions/join.ts
[ ] reducer/transitions/disconnect.ts
[ ] reducer/transitions/reconnect.ts
[ ] reducer/transitions/pointToUser.ts
[ ] reducer/transitions/evaluateSync.ts
[ ] reducer/transitions/setLiveSpeaker.ts
[ ] reducer/transitions/syncPause.ts
[ ] reducer/transitions/dropMic.ts
[ ] reducer/transitions/passMic.ts
[ ] reducer/transitions/sendGesture.ts
[ ] reducer/transitions/textInput.ts
[ ] reducer/transitions/endSession.ts
[ ] policy/can.ts
[ ] policy/rules/phaseRules.ts
[ ] policy/rules/roleRules.ts
[ ] policy/rules/presenceRules.ts
[ ] effects/effectTypes.ts
[ ] effects/runEffects.ts
[ ] effects/socketEffects.ts
[ ] effects/timerEffects.ts
[ ] effects/gliffEffects.ts
[ ] ui/resolvePanelConfig.ts
[ ] ui/templates/baseTemplates.ts
[ ] ui/templates/speakerPanel.ts
[ ] ui/templates/listenerPanel.ts
[ ] ui/templates/pickerPanel.ts
[ ] ui/templates/ghostPanel.ts
[ ] adapters/socketio/bindSocketHandlers.ts
[ ] adapters/socketio/clientEmitsAdapter.ts
[ ] adapters/socketio/emitToRoom.ts
[ ] adapters/socketio/emitToUser.ts
[ ] adapters/socketio/eventNames.ts
[ ] tests/protocol/consensus.test.ts
[ ] tests/protocol/ghostSpeakerDrop.test.ts
[ ] tests/protocol/lateJoinMidPointing.test.ts
[ ] tests/protocol/disconnectDuringSyncPause.test.ts
[ ] tests/protocol/pointerChangeBeforeLock.test.ts
[ ] tests/protocol/reconnectRestore.test.ts
[ ] tests/protocol/roomIsolation.test.ts
```

**Total Files:** 47

---

### B. Questions for GPT (Send After Reading This Spec)

1. **Does this spec match your architectural vision?**
2. **Any critical invariants missing?**
3. **Is the migration sequence optimal?**
4. **Should ghost TTL be in Slice 1 or deferred?**
5. **Any edge cases in consensus math I'm missing?**

---

**Document Complete.**  
**Ready for implementation.** 🚀

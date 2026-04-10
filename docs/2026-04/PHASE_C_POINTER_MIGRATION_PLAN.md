# Phase C: Pointer/Attention Migration Plan

**Goal:** Move pointer (attention) authority from V1 globals into Engine V2's `TableState`,  
wiring `POINT_TO_USER` and `EVALUATE_SYNC` in the reducer so the V2 engine can own consensus detection per room/session.

**Status:** 🔴 Not Started  
**Depends On:** Phase B complete ✅  
**Risk Level:** 🔴 High (touches live consensus logic)  
**Conflict Risk:** 🟡 Medium — overlaps with `SpeakerManager` wrappers, but V1 stays active until Step 7

---

## 🎯 Why This Is Needed

Right now, every `POINT_TO_USER` action logs:
```
[reducer] POINT_TO_USER not yet implemented
Effects Generated: 0
```

V2 shadow mode cannot track who is pointing at whom, cannot detect consensus, and cannot set a live speaker. Everything still runs through V1's global `pointerMap` and `evaluateSync()`.

**The state already exists in `TableState`:**
```typescript
pointerMap: Map<string, string>; // userId -> targetUserId  ← already in types.ts
liveSpeaker: string | null;      // ← already in types.ts
syncPause: boolean;              // ← already in types.ts
```

The reducer just needs to be wired to use it.

---

## 🏗️ Architecture: What Changes

### Current (V1 authority, V2 shadow only):
```
pointing event → socketHandler → pointerMap global → evaluateSync() (V1)
                              ↘ shadowDispatch → POINT_TO_USER → ❌ "not implemented"
```

### Target (V2 authority):
```
pointing event → socketHandler → shadowDispatch → POINT_TO_USER → reducer mutates TableState.pointerMap
                                                                 → EVALUATE_SYNC  → detects consensus
                                                                 → SET_LIVE_SPEAKER → emits live-speaker
                              ↘ V1 wrappers (setPointer via SpeakerManager) ← kept as fallback
```

**Key principle:** TableState is the single source of truth per room. `SpeakerManager` (Phase B) holds the V1-compatible layer. V2 engine holds truth in `tableState.pointerMap`.

---

## 📦 Files to Change

| File | What Changes |
|---|---|
| `server/engine-v2/reducer/reducer.ts` | Implement `POINT_TO_USER`, `EVALUATE_SYNC`, `SET_LIVE_SPEAKER` cases |
| `server/engine-v2/state/selectors.ts` | Add `getConnectedParticipantIds()`, `checkConsensus()` selectors |
| `server/engine-v2/shadow/actionMapper.ts` | Ensure `pointing` → `POINT_TO_USER` mapping includes `from`/`to` payload |
| `server/socketHandler.ts` | After shadow returns `SET_LIVE_SPEAKER` effect, execute it (V2 authority mode) |

**No changes needed to:**
- `SpeakerManager.ts` (stays as V1 compatibility layer)
- Any action handlers (they already use wrappers)
- `attentionPanelBuilder.ts` (reads from V1 path, unchanged for now)

---

## 📋 Step-by-Step Implementation

### Step 1: Add Consensus Selectors to `state/selectors.ts`

```typescript
/**
 * Get all connected (non-ghost, non-left) participant userIds
 */
export function getConnectedParticipantIds(state: TableState): string[] {
  return Array.from(state.participants.values())
    .filter(p => p.presence === "CONNECTED")
    .map(p => p.userId);
}

/**
 * Check if all connected participants point to the same target
 * AND that target also points to themselves (self-nomination)
 * Returns the consensus target userId, or null if no consensus
 */
export function checkConsensus(state: TableState): string | null {
  const connected = getConnectedParticipantIds(state);
  if (connected.length < 2) return null; // Need at least 2 people

  // Try each participant as potential speaker candidate
  for (const candidateId of connected) {
    const selfPointing = state.pointerMap.get(candidateId) === candidateId;
    if (!selfPointing) continue;

    const everyoneElsePoints = connected
      .filter(id => id !== candidateId)
      .every(id => state.pointerMap.get(id) === candidateId);

    if (everyoneElsePoints) return candidateId;
  }

  return null;
}
```

### Step 2: Implement `POINT_TO_USER` in reducer

```typescript
case ActionTypes.POINT_TO_USER: {
  const { from, to } = action.payload || {};
  // "from" and "to" are displayNames (V1 convention) OR userIds (V2)
  // We need to resolve to userId
  
  if (!from || !to) {
    console.warn(`[V2 Reducer] ⚠️ POINT_TO_USER missing from/to`);
    return [];
  }

  // Resolve displayName → userId (V1 sends displayNames)
  const fromParticipant = findParticipantByDisplayName(tableState, from) 
                        || tableState.participants.get(from);
  const toParticipant   = findParticipantByDisplayName(tableState, to)   
                        || tableState.participants.get(to);

  if (!fromParticipant || !toParticipant) {
    console.warn(`[V2 Reducer] ⚠️ POINT_TO_USER could not resolve participants: ${from} → ${to}`);
    return [];
  }

  // Update pointer in TableState
  tableState.pointerMap.set(fromParticipant.userId, toParticipant.userId);
  tableState.lastUpdated = Date.now();

  console.log(`[V2 Reducer] 👉 ${fromParticipant.displayName} → ${toParticipant.displayName}`);

  // Now check for consensus
  const consensusUserId = checkConsensus(tableState);
  
  if (consensusUserId && consensusUserId !== tableState.liveSpeaker) {
    // Consensus reached! Dispatch EVALUATE_SYNC result
    return [
      {
        type: "SOCKET_EMIT_ROOM",
        roomId: tableState.roomId,
        event: "update-pointing",
        data: { from, to },
      },
      {
        type: "SYSTEM_LOG",
        roomId: tableState.roomId,
        message: `Consensus: all pointing to ${consensusUserId}`,
        level: "info",
      },
      // Signal that V2 wants to set a live speaker
      // (executed only when V2 has full authority)
      {
        type: "V2_SET_LIVE_SPEAKER",
        roomId: tableState.roomId,
        userId: consensusUserId,
      },
    ];
  }

  return [
    {
      type: "SOCKET_EMIT_ROOM",
      roomId: tableState.roomId,
      event: "update-pointing",
      data: { from, to },
    },
  ];
}
```

### Step 3: Implement `EVALUATE_SYNC` in reducer

```typescript
case ActionTypes.EVALUATE_SYNC: {
  const consensusUserId = checkConsensus(tableState);

  if (!consensusUserId) {
    if (tableState.liveSpeaker !== null) {
      tableState.liveSpeaker = null;
      return [{
        type: "SOCKET_EMIT_ROOM",
        roomId: tableState.roomId,
        event: "live-speaker-cleared",
        data: {},
      }];
    }
    return [];
  }

  if (consensusUserId === tableState.liveSpeaker) return []; // No change

  tableState.liveSpeaker = consensusUserId;
  tableState.syncPause = false;
  tableState.phase = "LIVE_SPEAKER";

  const speaker = tableState.participants.get(consensusUserId);
  console.log(`[V2 Reducer] 🎤 Consensus! ${speaker?.displayName} goes LIVE`);

  return [
    {
      type: "SOCKET_EMIT_ROOM",
      roomId: tableState.roomId,
      event: "live-speaker",
      data: { name: speaker?.displayName, userId: consensusUserId },
    },
    {
      type: "SYSTEM_LOG",
      roomId: tableState.roomId,
      message: `🎤 All attention on ${speaker?.displayName}. Going LIVE.`,
      level: "info",
    },
    {
      type: "REBUILD_ALL_PANELS",
      roomId: tableState.roomId,
    },
  ];
}
```

### Step 4: Add `V2_SET_LIVE_SPEAKER` effect to Effect types

```typescript
// In state/types.ts Effect union:
| {
    type: "V2_SET_LIVE_SPEAKER";
    roomId: string;
    userId: string;
  }
| {
    type: "REBUILD_ALL_PANELS";
    roomId: string;
  }
```

### Step 5: Wire effect execution in `runEffects.ts`

```typescript
case "V2_SET_LIVE_SPEAKER": {
  // Only execute if ENGINE_V2 has full authority
  if (!ENGINE_V2_SPEAKER_MANAGER) break;
  // Dispatch EVALUATE_SYNC to complete the transition
  dispatch(effect.roomId, null, { type: "EVALUATE_SYNC", payload: {} });
  break;
}

case "REBUILD_ALL_PANELS": {
  // Signal socketHandler to rebuild panels for all users in room
  // (hook to be implemented in socketHandler)
  break;
}
```

### Step 6: Verify `actionMapper.ts` passes `from`/`to` payload

```typescript
// In shadow/actionMapper.ts, the "pointing" → POINT_TO_USER mapping must include:
case "pointing":
  return {
    type: ActionTypes.POINT_TO_USER,
    payload: { from: data.from, to: data.to }
  };
```

### Step 7: Validation (Shadow Mode First)

Run in shadow mode (`ENGINE_V2_SPEAKER_MANAGER=false`) and verify logs show:

```
[V2 Reducer] 👉 Amit → sdcs
[V2 Reducer] 👉 jkl → sdcs  
[V2 Reducer] 👉 Test2 → sdcs
[V2 Reducer] 👉 sdcs → sdcs
[V2 Reducer] 🎤 Consensus! sdcs goes LIVE
```

Compare V2 consensus detection against V1 `evaluateSync()` — they must agree on the same speaker.

### Step 8: V2 Authority Cutover

Enable `ENGINE_V2_SPEAKER_MANAGER=true` (already set in `.env`). V2 now drives consensus, V1 wrappers become redundant. Monitor for:
- Consensus fires correctly
- `live-speaker` event reaches all clients
- Panels rebuild correctly after speaker set

---

## 🔑 Key Complexity: displayName vs userId

**The V1 protocol uses displayNames everywhere** (`from: "Amit"`, `to: "sdcs"`).  
**V2 uses userId (socketId) as keys** in `tableState.participants`.

This mismatch is the trickiest part. The `POINT_TO_USER` reducer must:
1. Accept `from`/`to` as displayNames (from V1 shadow dispatch)
2. Resolve to `userId` via `participants` map lookup
3. Store as `userId → userId` in `tableState.pointerMap`

Helper needed:
```typescript
function findParticipantByDisplayName(state: TableState, displayName: string) {
  for (const [, p] of state.participants) {
    if (p.displayName === displayName) return p;
  }
  return null;
}
```

---

## ✅ Success Criteria

- [ ] `POINT_TO_USER` no longer logs "not yet implemented"
- [ ] `tableState.pointerMap` tracks real per-room pointer state
- [ ] `EVALUATE_SYNC` fires after every pointer change
- [ ] V2 independently detects consensus (matching V1 result)
- [ ] Two simultaneous rooms can have different live speakers
- [ ] No regression in V1 behavior

---

## 🚦 Implementation Order

- [ ] Step 1: Selectors (`checkConsensus`, `getConnectedParticipantIds`)
- [ ] Step 2: `POINT_TO_USER` in reducer
- [ ] Step 3: `EVALUATE_SYNC` in reducer
- [ ] Step 4: Add effect types to `state/types.ts`
- [ ] Step 5: Wire effects in `runEffects.ts`
- [ ] Step 6: Verify `actionMapper.ts` payload
- [ ] Step 7: Shadow validation (compare V1 vs V2 consensus)
- [ ] Step 8: V2 authority cutover

---

**Last Updated:** 2026-04-10  
**Status:** Ready to implement

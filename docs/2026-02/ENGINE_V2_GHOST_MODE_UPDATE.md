# 🔄 ENGINE V2: GHOST MODE UPDATE & SHADOW INTEGRATION

**Date:** February 21, 2026  
**Status:** Ready for Shadow Mode Integration  
**Purpose:** Document revised ghost mode rules and shadow integration plan

---

## 🔄 UPDATED GHOST MODE POLICY

### Critical Protocol Change

**OLD RULE:** Ghost = disconnected → auto-drop mic

**NEW RULE:** Ghost = neutral consent → keep mic unless all-ghost

---

## 📋 Revised Ghost Mode Specification

### What Is Ghost Mode? (Updated)

When a user disconnects (network drop, browser close), they enter **Ghost Mode**:

- `presence = GHOST`
- `socketId = null`
- **Avatar seat preserved** ✅
- **Still visible in UI** (grayed out) ✅
- **Excluded from consensus math** ✅ (don't count toward required votes)
- **Pointer preserved** (visual freeze) ✅
- **Mic preserved IF speaker** ✅ NEW

### Why This Change?

**Problem:** Network hiccups causing speaker to lose mic mid-thought.

**Solution:** Ghost is "neutral consent" — user is still part of the ritual, just temporarily offline.

**Philosophy:** The circle holds space for them. They haven't left. They're just momentarily absent.

---

## 🔒 Consensus Rules (Clarified)

### Ghosts and Voting

**Rule:** Ghosts do NOT count toward `requiredVotes`.

```typescript
// Consensus evaluation
const connected = participants.filter((p) => p.presence === "CONNECTED");
const requiredVotes = connected.length;

// Ghosts are visible but don't block consensus
// If 3 connected users all point to Alice → consensus achieved
// (Even if 2 ghost users exist)
```

**Why:** Prevents deadlock. Ghosts can't vote, so they shouldn't block decisions.

---

## 🎤 Speaker Ghost Behavior (Updated)

### Scenario: Active Speaker Goes Ghost

**OLD BEHAVIOR:**

```typescript
if (liveSpeaker disconnects) {
  liveSpeaker = null;
  phase = ATTENTION_SELECTION;
  emit("Speaker dropped. Returning to picker.");
}
```

**NEW BEHAVIOR:**

```typescript
if (liveSpeaker disconnects) {
  participant.presence = GHOST;
  participant.socketId = null;

  // Check if ALL users are now ghost
  if (allUsersAreGhost) {
    liveSpeaker = null;
    phase = ENDING;
    emit("All users disconnected. Entering grace period.");
  } else {
    // Speaker keeps mic while ghost
    // Other connected users see "Speaker temporarily disconnected"
    emit("Speaker disconnected but mic held (ghost mode)");
  }
}
```

**Rationale:**

- Brief network hiccup shouldn't interrupt flow
- Speaker can reconnect and continue
- Only if entire room goes ghost do we enter ENDING phase

---

## 🔄 Reconnect Behavior (Speaker Ghost)

### Scenario: Ghost Speaker Reconnects

```typescript
if (ghostSpeaker reconnects) {
  participant.presence = CONNECTED;
  participant.socketId = newSocketId;

  // Speaker is still liveSpeaker
  // Phase is still LIVE_SPEAKER
  // Resume speaking immediately

  emit("Speaker reconnected. Resuming...");
  emitFullStateSnapshot(userId);
}
```

**User Experience:**

- Speaker's mic indicator stayed visible (grayed out)
- On reconnect, mic indicator lights up again
- No transition back to picker mode
- Seamless continuation

---

## ⚖️ Edge Case: All Users Ghost

### Scenario: Everyone Disconnects

```typescript
const connected = getConnectedParticipants(tableState);
const ghosts = getGhostParticipants(tableState);

if (connected.length === 0 && ghosts.length > 0) {
  // All ghost → enter grace period
  liveSpeaker = null; // NOW we clear speaker
  phase = ENDING;
  startGracePeriod(30000); // 30 seconds to reconnect

  emit("All users disconnected. 30 second grace period.");
}
```

**Grace Period Rules:**

- Any user reconnects within 30s → phase = ATTENTION_SELECTION (restart)
- No reconnect within 30s → phase = ENDED → cleanup room

---

## 🧪 Shadow Mode Integration Plan

### What Is Shadow Mode?

Run Engine V2 **alongside** V1 without affecting production:

- V2 receives all actions
- V2 computes state transitions
- V2 **does NOT execute effects**
- V2 **only logs observations**

**Purpose:**

- Validate room isolation
- Validate identity mapping
- Catch invariant violations early
- Learn from real traffic
- Zero risk to production

---

## 🔌 Shadow Mode Implementation

### Step 1: Create Shadow Dispatcher

```typescript
// server/engine-v2/shadow/shadowDispatcher.ts

import { dispatch } from "../reducer/dispatch";
import { roomRegistry } from "../registry/RoomRegistry";

export function shadowDispatch(
  roomId: string,
  userId: string | null,
  action: any,
): void {
  try {
    // Get or create room in v2 registry
    const room = roomRegistry.getOrCreateRoom(roomId);

    // Capture state before
    const phaseBefore = room.phase;
    const speakerBefore = room.liveSpeaker;
    const connectedBefore = Array.from(room.participants.values()).filter(
      (p) => p.presence === "CONNECTED",
    ).length;
    const ghostBefore = Array.from(room.participants.values()).filter(
      (p) => p.presence === "GHOST",
    ).length;

    // Dispatch to v2 (will mutate state but not run effects)
    const effects = dispatch(roomId, userId, action);

    // Capture state after
    const phaseAfter = room.phase;
    const speakerAfter = room.liveSpeaker;
    const connectedAfter = Array.from(room.participants.values()).filter(
      (p) => p.presence === "CONNECTED",
    ).length;
    const ghostAfter = Array.from(room.participants.values()).filter(
      (p) => p.presence === "GHOST",
    ).length;

    // Log compact summary
    console.log(
      `[V2 Shadow] ${roomId} | ${userId || "SYSTEM"} | ${action.type}`,
    );
    console.log(`  Phase: ${phaseBefore} → ${phaseAfter}`);
    console.log(
      `  Speaker: ${speakerBefore || "none"} → ${speakerAfter || "none"}`,
    );
    console.log(`  Connected: ${connectedBefore} → ${connectedAfter}`);
    console.log(`  Ghosts: ${ghostBefore} → ${ghostAfter}`);
    console.log(`  Effects: ${effects.length}`);
    console.log(`  Invariants: ✅ OK`);
  } catch (error) {
    // Catch invariant violations or reducer bugs
    console.error(
      `[V2 Shadow] ❌ ERROR in ${roomId} | ${action.type}:`,
      error.message,
    );
  }
}
```

### Step 2: Wire Into Legacy Socket Handler

```typescript
// server/socketHandler.ts (legacy)

import { shadowDispatch } from "./engine-v2/shadow/shadowDispatcher";

// Inside your existing socket handlers:
socket.on("clientEmits", (payload) => {
  // V1 logic (existing, untouched)
  routeAction(payload, { io, socket /* ... */ });

  // V2 shadow (new, passive observer)
  try {
    const roomId = socket.data.roomId || "default-room";
    const userId = socket.data.userId || socket.id;

    shadowDispatch(roomId, userId, {
      type: mapLegacyActionToV2(payload.type),
      payload: payload.data,
    });
  } catch (error) {
    // Swallow errors, don't break V1
    console.error("[Shadow] Failed:", error);
  }
});
```

### Step 3: Action Mapping Helper

```typescript
// server/engine-v2/shadow/actionMapper.ts

export function mapLegacyActionToV2(legacyType: string): string {
  const mapping: Record<string, string> = {
    "request-join": "JOIN_SESSION",
    disconnect: "DISCONNECT",
    reconnect: "RECONNECT",
    "change-pointing": "POINT_TO_USER",
    "send-gesture": "SEND_GESTURE",
    "drop-mic": "DROP_MIC",
    // ... add more mappings
  };

  return mapping[legacyType] || "UNHANDLED_ACTION";
}
```

---

## 📊 Shadow Mode Logs (Expected Output)

### Example Session

```
[V2 Shadow] room-abc123 | user-456 | JOIN_SESSION
  Phase: LOBBY → LOBBY
  Speaker: none → none
  Connected: 0 → 1
  Ghosts: 0 → 0
  Effects: 2
  Invariants: ✅ OK

[V2 Shadow] room-abc123 | user-789 | JOIN_SESSION
  Phase: LOBBY → LOBBY
  Speaker: none → none
  Connected: 1 → 2
  Ghosts: 0 → 0
  Effects: 2
  Invariants: ✅ OK

[V2 Shadow] room-abc123 | user-456 | POINT_TO_USER
  Phase: ATTENTION_SELECTION → SYNC_PAUSE
  Speaker: none → user-789
  Connected: 2 → 2
  Ghosts: 0 → 0
  Effects: 3
  Invariants: ✅ OK

[V2 Shadow] room-abc123 | user-789 | DISCONNECT
  Phase: LIVE_SPEAKER → LIVE_SPEAKER
  Speaker: user-789 → user-789
  Connected: 2 → 1
  Ghosts: 0 → 1
  Effects: 2
  Invariants: ✅ OK
  Note: Speaker kept mic while ghost (NEW POLICY)

[V2 Shadow] room-abc123 | user-789 | RECONNECT
  Phase: LIVE_SPEAKER → LIVE_SPEAKER
  Speaker: user-789 → user-789
  Connected: 1 → 2
  Ghosts: 1 → 0
  Effects: 3
  Invariants: ✅ OK
  Note: Speaker resumed seamlessly
```

---

## ✅ Shadow Mode Success Criteria

### After 10 Minutes of Real Traffic

**Validate:**

- [ ] No invariant violations
- [ ] Room isolation (no cross-room contamination)
- [ ] Phase transitions make sense
- [ ] Ghost presence tracked correctly
- [ ] Speaker persistence works (ghost doesn't drop mic)
- [ ] Consensus math excludes ghosts
- [ ] Action mapping is complete (no UNHANDLED_ACTION spam)

**If All Pass:**

- V2 foundation is solid
- Ready to implement actual transitions
- Safe to proceed with full integration

---

## 🎯 Implementation Order

### Today (Shadow Mode)

1. ✅ Create `shadowDispatcher.ts`
2. ✅ Create `actionMapper.ts`
3. ✅ Wire into `socketHandler.ts`
4. ✅ Deploy and monitor logs
5. ✅ Validate no errors for 10 minutes

### Tomorrow (First Transition)

1. Implement `JOIN_SESSION` transition
2. Implement `DISCONNECT` transition (ghost mode)
3. Implement `RECONNECT` transition (snapshot)
4. Shadow mode logs should show state changes

### Day 3 (Consensus)

1. Implement `POINT_TO_USER` transition
2. Implement `EVALUATE_SYNC` transition
3. Implement `SET_LIVE_SPEAKER` transition
4. Shadow mode shows full session flow

---

## 🔒 Updated Invariants for Ghost Speaker

### New Invariant Checks

**Invariant 9 (Modified):** Speaker presence validation

```typescript
// OLD: Speaker must be CONNECTED
if (liveSpeaker !== null) {
  const speaker = participants.get(liveSpeaker);
  if (speaker && speaker.presence !== "CONNECTED") {
    throw new InvariantViolation("Speaker must be CONNECTED");
  }
}

// NEW: Speaker can be CONNECTED or GHOST
if (liveSpeaker !== null) {
  const speaker = participants.get(liveSpeaker);
  if (!speaker) {
    throw new InvariantViolation("Speaker must exist in participants");
  }
  if (speaker.presence !== "CONNECTED" && speaker.presence !== "GHOST") {
    throw new InvariantViolation("Speaker must be CONNECTED or GHOST");
  }
}
```

**Invariant 10 (Modified):** All-ghost check

```typescript
// OLD: All ghost → phase must be ENDING/ENDED
const connected = getConnectedParticipants(tableState);
const ghosts = getGhostParticipants(tableState);
if (connected.length === 0 && ghosts.length > 0) {
  if (phase !== "ENDING" && phase !== "ENDED") {
    throw new InvariantViolation("All ghost but phase not ENDING/ENDED");
  }
}

// NEW: Same logic, but speaker can be ghost during active phase
// Only when ALL users are ghost do we transition to ENDING
```

---

## 📝 Action Items

### Update Files

1. **`state/invariants.ts`**
   - Modify Invariant 9: Allow ghost speaker
   - Keep Invariant 10: All-ghost → ENDING

2. **`engine-v2/shadow/shadowDispatcher.ts`** (NEW)
   - Create shadow dispatcher

3. **`engine-v2/shadow/actionMapper.ts`** (NEW)
   - Map legacy action names to V2

4. **`socketHandler.ts`** (LEGACY, minimal change)
   - Add shadow dispatch call after V1 routing

---

## 🚀 Ready for Shadow Integration

**Foundation:** ✅ Complete  
**Ghost Policy:** ✅ Updated  
**Shadow Plan:** ✅ Documented  
**Risk:** ✅ Zero (passive observer only)

**Next Step:** Create shadow dispatcher and wire it in. 🫡

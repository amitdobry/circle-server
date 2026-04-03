# 🗂️ ROOM STATE MODEL

**Purpose:** Define the complete state shape for a SoulCircle room/session.

**Status:** 🚧 Initial Draft - Feb 17, 2026

---

## 📦 Room State Container

Each session/room maintains its own isolated state:

```typescript
interface RoomState {
  // Session metadata
  sessionId: string;
  sessionActive: boolean;
  sessionStartTime: number; // Unix timestamp
  sessionDurationMinutes: number; // Default: 60
  sessionTimer: NodeJS.Timeout | null;

  // Participant management
  users: Map<socketId: string, UserInfo>;

  // Attention/pointer system
  pointerMap: Map<from: string, to: string>;
  liveSpeaker: string | null; // userName or null
  isSyncPauseMode: boolean;

  // Conversation log
  gliffLog: GliffMessage[];
  maxGliffLogSize: number; // Default: 20
}
```

---

## 👤 User Info Structure

```typescript
interface UserInfo {
  socketId: string;
  name: string;
  avatarId: string;
  state: UserState;
  joinedAt: number; // timestamp
}

type UserState =
  | "regular"
  | "speaking"
  | "thinking"
  | "waiting"
  | "hasClickedMouth"
  | "hasClickedBrain"
  | "hasClickedEar"
  | "micIsDropped"
  | "hasDroppedTheMic"
  | "isPassingTheMic"
  | "isPickingBlueSpeaker"
  | "micOfferReceivedFromBlue"
  | "acceptedBlueMic"
  | "declinedBlueMic"
  | "waitingOnPickerOfBlueSpeaker"
  | "awaitingUserMicOfferResolutionFromBlueInitiator"
  | "waitingOnTargetResponseFromBlue"
  | "postSpeakerWaitingOnBlue"
  | "postSpeakerWaitingOnBlueAfterPick";
```

---

## 💬 Gliff Message Structure

```typescript
interface GliffMessage {
  userName: string;
  message: {
    messageType: "textInput" | "gesture" | "action" | "context";
    content: string;
    timestamp: number;
    emoji?: string; // for gesture messages
  };
}
```

---

## 🔒 Invariants (Rules That Must Always Hold)

### Session Invariants

1. **Single Active Session Per Room**

   - Only one session can be active at a time
   - `sessionActive === true` ⇒ timer is running

2. **Session Timer Consistency**
   - If `sessionActive`, then `sessionTimer !== null`
   - Timer auto-ends session when duration expires

### Speaker Invariants

3. **At Most One Live Speaker**

   - `liveSpeaker === null` OR `liveSpeaker` is a valid userName in `users`
   - Cannot have multiple simultaneous speakers

4. **Sync Pause Isolation**
   - `isSyncPauseMode === true` ⇒ brief freeze (2-3 seconds)
   - Used for: consensus moment, blue gesture resolution

### Pointer Invariants

5. **Pointer Validity**

   - All keys in `pointerMap` must exist in `users`
   - All values in `pointerMap` must exist in `users`

6. **Consensus Rule**
   - If all users point to the same target → that target becomes liveSpeaker
   - Evaluated on every pointer change

### Gliff Log Invariants

7. **Room Isolation** ⚠️ **CRITICAL**

   - Each room has its own `gliffLog` array
   - No global shared log
   - Messages from Room A never appear in Room B

8. **Memory Bounds**

   - `gliffLog.length <= maxGliffLogSize`
   - Oldest messages are trimmed when limit exceeded

9. **Text Message Merging**
   - Consecutive text from same user are merged character-by-character
   - Gestures/actions flush the buffer (create new entry)

---

## 🚨 Critical Ownership Rules

### Who Mutates What

| State Field       | Mutated By                            | When                           |
| ----------------- | ------------------------------------- | ------------------------------ |
| `sessionActive`   | Session start/end logic               | User joins (first) / Timer end |
| `liveSpeaker`     | Consensus evaluation, speaker actions | Pointer alignment / Drop mic   |
| `pointerMap`      | User click actions                    | Point, Ready to Glow           |
| `isSyncPauseMode` | Consensus achieved, Blue gesture flow | Brief freeze moments           |
| `gliffLog`        | `createGliffLog()` in gliffLogService | Text input, Gesture emission   |
| `users`           | Join/Leave handlers                   | Socket connect/disconnect      |

---

## 🔄 Room Lifecycle

```
1. ROOM CREATED
   └─→ Empty state initialized

2. FIRST USER JOINS
   └─→ sessionActive = true
   └─→ Timer starts (60min default)

3. USERS JOIN/LEAVE
   └─→ users Map updated
   └─→ Avatars claimed/released

4. TIMER EXPIRES OR LAST USER LEAVES
   └─→ sessionActive = false
   └─→ gliffLog cleared
   └─→ All users navigated away

5. ROOM CLEANUP
   └─→ State garbage collected
```

---

## ⚠️ Known Issues to Fix

### 1. **Gliff Log is Currently Global** 🔴 CRITICAL

**Problem:** From `gliffLogService.ts`:

```typescript
const gliffMemory: GliffMessage[] = []; // ❌ GLOBAL ARRAY
```

**Impact:** All rooms share the same log → messages bleed across sessions

**Fix Required:**

```typescript
// BEFORE (broken):
const gliffMemory: GliffMessage[] = [];

// AFTER (fixed):
const gliffMemoryByRoom = new Map<string, GliffMessage[]>();

export function createGliffLog(
  entry: GliffMessage,
  io: Server,
  roomId: string // ← Add room scoping
) {
  if (!gliffMemoryByRoom.has(roomId)) {
    gliffMemoryByRoom.set(roomId, []);
  }

  const gliffMemory = gliffMemoryByRoom.get(roomId)!;
  // ... rest of logic

  io.to(roomId).emit("gliffLog:update", gliffMemory); // ← Scoped broadcast
}
```

### 2. **Users Map is Global** 🔴 CRITICAL

**Problem:** From `socketHandler.ts`:

```typescript
const users = new Map<string, UserInfo>(); // ❌ GLOBAL MAP
```

**Impact:** All rooms share participants → cross-contamination

**Solution:** Move into RoomState or create RoomManager

---

## 📊 Visual State Diagram

```
┌─────────────────────────────────────────────────────┐
│                    ROOM STATE                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐         ┌─────────────┐         │
│  │ Session Info │         │   Users     │         │
│  ├──────────────┤         ├─────────────┤         │
│  │ • active     │         │ Map<id,Info>│         │
│  │ • startTime  │         │             │         │
│  │ • timer      │         └─────────────┘         │
│  └──────────────┘                                  │
│                                                     │
│  ┌──────────────┐         ┌─────────────┐         │
│  │ Speaker      │         │  Pointers   │         │
│  ├──────────────┤         ├─────────────┤         │
│  │ • liveSpeaker│─────────│ Map<from,to>│         │
│  │ • syncPause  │         │             │         │
│  └──────────────┘         └─────────────┘         │
│                                                     │
│  ┌──────────────────────────────────────┐         │
│  │         Gliff Log                    │         │
│  ├──────────────────────────────────────┤         │
│  │ • Array<GliffMessage> (max 20)      │         │
│  │ • Text merging for same user        │         │
│  │ • Gesture/action = new entry        │         │
│  └──────────────────────────────────────┘         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Priority Fixes

| Issue             | Severity    | Impact                | Effort  |
| ----------------- | ----------- | --------------------- | ------- |
| Global gliffLog   | 🔴 Critical | Multi-room failure    | 2 hours |
| Global users Map  | 🔴 Critical | Session contamination | 4 hours |
| Text merge bug    | 🟡 Medium   | Paste doesn't work    | 1 hour  |
| No error handling | 🟡 Medium   | Silent failures       | 2 hours |

---

## 📚 References

- User State Definitions: `listenerCatalog.ts`
- Pointer Logic: `socketHandler.ts` (`evaluateSync` function)
- Gliff Log: `gliffLogService.ts`
- Action Handlers: `server/actions/` directory

---

## ✅ Validation Checklist

When implementing room-scoped state:

- [ ] Each room has isolated `gliffLog`
- [ ] Each room has isolated `users` Map
- [ ] Each room has isolated `pointerMap`
- [ ] Broadcasts use `io.to(roomId)` not `io.emit()`
- [ ] Room cleanup on last user leave
- [ ] No memory leaks from abandoned rooms

---

**This document is the foundation. All other docs build on this.**

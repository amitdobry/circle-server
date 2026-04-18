# Engine V2 — Gliff Logging Analysis & Fix Plan

**Date:** April 17, 2026  
**Issue:** Conversation log ("ich gliff") not appearing on this machine  
**Status:** Diagnosing root cause

---

## 🚨 IMPORTANT UPDATE

**Original assumption was WRONG:** The issue is NOT that Engine V2 doesn't have gliff logging implemented.

**Corrected understanding:**

- Both machines are running `ENGINE_V2_GLIFF_LOGGING=true` ✅
- Both machines are running `ENGINE_MODE=V2_FULL` ✅
- **V1 gliff logging is STILL ACTIVE** - it was never disabled! ✅
- Gestures still trigger V1 handlers: `clientEmits` → `routeAction()` → `handleSyncedGesture()` → `createGliffLog()` ✅

**Actual issue:** Something machine-specific is preventing gliff from displaying:

- Socket connection problem?
- Client-side rendering issue?
- Environment configuration difference?
- Browser caching old code?

**See [Troubleshooting](#troubleshooting-why-isnt-gliff-appearing) section below for diagnostics.**

---

## Problem Statement

The "ich gliff" (conversation log) is not displaying when Engine V2 is active. This feature works correctly on other machines running the same code in V1 mode, but fails when `ENGINE_V2_FULL` authority is enabled.

**User Impact:**

- No visible conversation history during sessions
- Gestures, text input, and actions are not logged
- Loss of important contextual information during circles

---

## Root Cause Analysis

### Why It's Missing

**CORRECTED ANALYSIS:** After deeper investigation, the issue is NOT that V1 gliff logging is disabled. Both machines are running `ENGINE_V2_GLIFF_LOGGING=true`, and the V1 action handlers (`handleSyncedGesture.ts`, etc.) ARE still being called via `routeAction()`.

**The real issue:**

1. **V1 Gliff Logging Still Active**
   - `socket.on("clientEmits")` → `routeAction()` → `handleSyncedGesture()` → `gesture.triggerEffect()` → `createGliffLog()`
   - This path is NOT blocked by Engine V2
   - Text input via `logBar:update` also calls `createGliffLog()` directly
   - **V1 gliff logging should still work!**

2. **GLIFF_LOGGING Flag is Misleading**
   - `ENGINE_V2_GLIFF_LOGGING=true` flag exists but **doesn't control V1 gliff logging**
   - It was intended for future V2 gliff integration (via `GLIFF_APPEND` effects)
   - V1 gliff service runs independently of this flag

3. **Possible Actual Issues**
   - Gestures might not be triggering at all (client issue?)
   - Socket connection might not be established properly
   - `gliffLog:update` broadcasts might not be reaching client
   - Server-side gliff creation might be working but client not displaying
   - Different issue on THIS machine vs the working machine

### Current State

**Effect Definition** (`server/engine-v2/state/types.ts`):

```typescript
{
  type: "GLIFF_APPEND";
  roomId: string;
  entry: GliffMessage;
}
```

**Effect Handler** (`server/engine-v2/effects/runEffects.ts:240-246`):

```typescript
case "GLIFF_APPEND":
  console.warn(
    "[runEffects] GLIFF_APPEND not yet implemented:",
    effect.roomId,
  );
  // TODO: Integrate with gliffService
  break;
```

**Reducer:** No actions emit `GLIFF_APPEND` effects yet.

---

## What is Gliff Logging?

The "gliff" is the conversation log — a real-time feed of:

- **Gestures:** Emoji-based expressions (👋, 🤔, 💡, etc.)
- **Text Input:** Character-by-character typing (with backspace handling)
- **Actions:** Mic handoffs, speaker changes, consensus events
- **Context:** Session milestones and phase transitions

**Technical Details:**

- Max 20 entries in memory
- Character-by-character text merging (avoids spam)
- Broadcast via `gliffLog:update` socket event
- Service: `server/gliffLogService.ts`

---

## Troubleshooting: Why Isn't Gliff Appearing?

Since V1 gliff logging should still work, let's diagnose the actual issue:

### Check 1: Are Gestures Being Sent from Client?

**Client console should show:**

```javascript
// When you click a gesture button
socket.emit("clientEmits", {
  name: "YourName",
  type: "ear", // or "brain", "mouth", etc.
  subType: "wave",
  actionType: "syncedGesture",
});
```

**Test:** Open browser DevTools → Console → send a gesture → check if `clientEmits` is logged

### Check 2: Is Server Receiving Gestures?

**Server should log:**

```
🎧 👋 YourName says: "Wave"
🧾 gliffMemory snapshot:
[{ "userName": "YourName", "message": { "messageType": "gesture", "content": "Wave", ... }}]
```

**Test:** Check server console after sending gesture

### Check 3: Is Server Broadcasting `gliffLog:update`?

**In `gliffLogService.ts:67`:**

```typescript
io.emit("gliffLog:update", gliffMemory);
```

**Test:** Add this to server socket handler:

```typescript
io.on("connection", (socket) => {
  socket.onAny((event, ...args) => {
    console.log(`[Socket Event] ${event}`, args);
  });
});
```

### Check 4: Is Client Receiving `gliffLog:update`?

**In browser console:**

```javascript
socket.on("gliffLog:update", (data) => {
  console.log("📬 Received gliffLog:update:", data);
});
```

**Test:** Add this temporarily to `TableView.tsx`

### Check 5: Is GliffLog Component Rendering?

**In `TableView.tsx`:**

```typescript
const [gliffLog, setGliffLog] = useState<GliffMessage[]>([]);
// ...
<GliffLog entries={gliffLog} me={me} />
```

**Test:** Add `console.log("GliffLog entries:", gliffLog);` before rendering

### Check 6: Compare With Working Machine

**What to check:**

1. `.env` file differences (especially `ENGINE_V2_*` flags)
2. Git branch/commit differences
3. `npm` package versions (`package-lock.json`)
4. Node version (`node --version`)
5. Browser differences
6. Network/firewall blocking WebSocket events

---

## Implementation Plan (REVISED)

Given that V1 gliff logging should still work, the implementation plan changes:

### Option A: Debug Current Setup First

1. **Run diagnostics above** to identify why gliff isn't showing
2. **Fix the underlying issue** (likely socket, client, or rendering problem)
3. **Defer V2 gliff implementation** until we understand the real problem

### Option B: Implement V2 Gliff Anyway (Future-Proofing)

Even if V1 gliff works eventually, V2 should have its own gliff logging for:

- Room-scoped gliff logs (multi-table support)
- Consistency with V2 architecture
- Eventually deprecating V1 handlers

---

## Implementation Plan (V2 Gliff Integration)

### Phase 1: Connect GLIFF_APPEND Effect Handler

**File:** `server/engine-v2/effects/runEffects.ts`

**Change:**

```typescript
case "GLIFF_APPEND":
  if (getFeatureFlag("GLIFF_LOGGING")) {
    // Import gliffLogService at top of file
    const { createGliffLog } = require("../gliffLogService");
    createGliffLog(effect.entry, io);
    console.log(
      `[runEffects] GLIFF_APPEND: ${effect.entry.message.messageType} from ${effect.entry.userName}`
    );
  }
  break;
```

**Why:** Connects the effect system to the existing gliff service.

---

### Phase 2: Emit GLIFF_APPEND Effects from Reducer

**File:** `server/engine-v2/reducer/reducer.ts`

Add effect emission for these action types:

#### 2.1 Gesture Actions

```typescript
case "SYNCED_GESTURE":
case "PAUSE_FOR_THOUGHT":
  // ... existing logic ...

  if (getFeatureFlag("GLIFF_LOGGING")) {
    effects.push({
      type: "GLIFF_APPEND",
      roomId,
      entry: {
        userName: name,
        message: {
          messageType: "gesture",
          content: action.gestureLabel || "gesture",
          emoji: action.emoji,
          timestamp: Date.now(),
        },
      },
    });
  }
```

#### 2.2 Key Session Events

```typescript
case "START_SESSION":
  // ... existing logic ...

  if (getFeatureFlag("GLIFF_LOGGING")) {
    effects.push({
      type: "GLIFF_APPEND",
      roomId,
      entry: {
        userName: name,
        message: {
          messageType: "context",
          content: `Session started by ${name}`,
          timestamp: Date.now(),
        },
      },
    });
  }
```

#### 2.3 Live Speaker Events

```typescript
case "POINT_AT_SPEAKER":
  // ... after consensus check ...

  if (liveSpeaker && getFeatureFlag("GLIFF_LOGGING")) {
    effects.push({
      type: "GLIFF_APPEND",
      roomId,
      entry: {
        userName: liveSpeaker,
        message: {
          messageType: "context",
          content: `🎤 ${liveSpeaker} is now speaking`,
          emoji: "🎤",
          timestamp: Date.now(),
        },
      },
    });
  }
```

#### 2.4 Mic Handoff Events

```typescript
case "DROP_MIC":
case "PASS_MIC":
case "ACCEPT_MIC":
case "DECLINE_MIC":
  // ... existing logic ...

  if (getFeatureFlag("GLIFF_LOGGING")) {
    effects.push({
      type: "GLIFF_APPEND",
      roomId,
      entry: {
        userName: name,
        message: {
          messageType: "action",
          content: getMicActionLabel(action.type),
          timestamp: Date.now(),
        },
      },
    });
  }
```

---

### Phase 3: Text Input Integration

**File:** `server/socketHandler.ts`

The `logBar:update` handler already uses `createGliffLog()` directly:

```typescript
socket.on(
  "logBar:update",
  ({ text, userName }: { text: string; userName: string }) => {
    createGliffLog(
      {
        userName,
        message: {
          messageType: "textInput",
          content: text,
          timestamp: Date.now(),
        },
      },
      io,
    );
  },
);
```

**No change needed** — text input is event-sourced outside the reducer, so it continues to work through the existing socket handler.

---

### Phase 4: Room Scoping (Future Enhancement)

**Current Limitation:**

- `gliffLogService.ts` uses a single global array
- Multi-room support requires room-scoped gliff logs

**Future Work:**

```typescript
// gliffLogService.ts (future)
const gliffMemoryByRoom = new Map<string, GliffMessage[]>();

export function createGliffLog(
  entry: GliffMessage,
  io: Server,
  roomId: string,
) {
  if (!gliffMemoryByRoom.has(roomId)) {
    gliffMemoryByRoom.set(roomId, []);
  }
  const gliffMemory = gliffMemoryByRoom.get(roomId)!;
  // ... existing logic ...
  io.to(roomId).emit("gliffLog:update", gliffMemory);
}
```

**Not critical for single-room usage** — can defer until multi-room is actively used.

---

## Testing Plan

### Manual Testing

1. Start Engine V2 with `ENGINE_V2_FULL` mode
2. Join session, start circle
3. Send gestures → verify they appear in gliff log
4. Type in text input → verify character-by-character updates
5. Point at speaker → verify consensus event logged
6. Drop mic → verify action logged
7. Check logs for `[runEffects] GLIFF_APPEND` confirmations

### Automated Testing

Add test to `server/engine-v2/tests/`:

```typescript
describe("GLIFF_APPEND effects", () => {
  it("emits GLIFF_APPEND on gesture", () => {
    const { state, effects } = dispatch(state, {
      type: "SYNCED_GESTURE",
      roomId,
      userId,
      name: "Alice",
      gestureLabel: "Wave",
      emoji: "👋",
    });

    const gliffEffects = effects.filter((e) => e.type === "GLIFF_APPEND");
    expect(gliffEffects).toHaveLength(1);
    expect(gliffEffects[0].entry.message.content).toBe("Wave");
  });
});
```

---

## Feature Flag Behavior

**Flag:** `GLIFF_LOGGING` (already exists)

- `true` → Gliff effects are emitted and executed
- `false` → Gliff effects are skipped (no logging)

**Current default:** `true` in production

---

## Risks & Considerations

### Low Risk

- Gliff logging is a read-only side effect
- Does not affect state transitions
- Failure to log does not break session functionality

### Performance

- 20-entry limit prevents memory bloat
- Text merging reduces socket spam
- Already proven in V1 production

### Multi-Room

- Current implementation is single-room aware
- Future enhancement needed for true multi-room isolation
- Not blocking for current usage

---

## Implementation Order

1. **Phase 1** (5 min) — Connect effect handler to gliffLogService
2. **Phase 2.1** (10 min) — Add gesture gliff effects
3. **Phase 2.2** (10 min) — Add session milestone gliff effects
4. **Phase 2.3** (10 min) — Add speaker consensus gliff effects
5. **Phase 2.4** (10 min) — Add mic handoff gliff effects
6. **Test** (15 min) — Manual verification
7. **Commit & Deploy** (5 min)

**Total Estimate:** ~1 hour

---

## Success Criteria

✅ Gliff log appears on UI when Engine V2 is active  
✅ Gestures are logged with emoji  
✅ Speaker consensus events appear  
✅ Mic handoffs are logged  
✅ Text input continues to work (no regression)  
✅ Feature flag controls gliff behavior  
✅ No performance degradation

---

## Related Documents

- `ENGINE_V2_COMPLETE_SPEC_AND_PLAN.md` — Overall V2 architecture
- `ENGINE_V2_FEATURE_FLAGS_COMPLETE.md` — Feature flag system
- `PHASE_D_TEST_RESULTS.md` — Current test coverage
- `server/gliffLogService.ts` — Existing gliff implementation
- `server/engine-v2/effects/runEffects.ts` — Effect execution

---

## 🔍 Immediate Action Items

### Right Now: Diagnose the Issue

**User reported:** Gliff works on another machine with same code, but not on this machine.

**Most Likely Causes:**

1. **Socket Connection Issue**
   - Check browser console for WebSocket errors
   - Verify `socket.connected` is `true`
   - Check if other socket events work (participant updates, pointer updates)

2. **Client-Side Rendering Issue**
   - Gliff data arrives but component not visible
   - CSS hiding the gliff log UI
   - React state not updating properly

3. **Environment Difference**
   - Different `.env` configuration
   - Different Git commit/branch
   - Different npm packages installed
   - Browser caching old code

**Next Steps:**

1. **Check server logs:** Look for `🧾 gliffMemory snapshot` after sending gestures
2. **Check browser console:** Add temporary logging in `TableView.tsx` gliffLog useEffect
3. **Compare `.env` files:** Between working and non-working machine
4. **Hard refresh browser:** Ctrl+Shift+R to clear cache
5. **Restart both:** Kill server & frontend, restart both, hard refresh browser

---

## Next Steps

1. Review and approve this plan
2. **Run diagnostics first** (see Troubleshooting section above)
3. **Fix immediate issue** if V1 gliff should work
4. Implement Phase 1 (effect handler) - if V2 gliff is desired
5. Implement Phase 2 (reducer emissions)
6. Test manually in local environment
7. Add automated test coverage
8. Merge and deploy
9. Verify on production environment

**Priority:** High (UX impact - conversation log is a key feature)

---

_This document will be updated as diagnostics and implementation progress._

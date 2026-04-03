# 🔌 ENGINE V2: SHADOW MODE INTEGRATION GUIDE

**Purpose:** Wire Engine V2 into production as a passive observer  
**Risk:** Zero (does not execute effects or affect V1 behavior)  
**Time:** 5 minutes

---

## 📝 Integration Steps

### Step 1: Import Shadow Dispatcher

Add to the top of `socketHandler.ts`:

```typescript
// At the top of socketHandler.ts, add:
import {
  shadowDispatch,
  enableShadowMode,
} from "./engine-v2/shadow/shadowDispatcher";
import {
  mapLegacyToV2Action,
  extractUserId,
  extractRoomId,
} from "./engine-v2/shadow/actionMapper";
```

### Step 2: Enable Shadow Mode on Server Start

After the server initializes, enable shadow mode:

```typescript
// In your server startup (index.ts or socketHandler.ts init)
export function initSocketHandler(io: Server) {
  // ... existing initialization ...

  // Enable Engine V2 shadow mode
  if (process.env.ENGINE_V2_SHADOW === "true") {
    enableShadowMode();
    console.log("[Server] Engine V2 shadow mode ENABLED");
  }

  // ... rest of initialization ...
}
```

### Step 3: Add Shadow Hook to Each Socket Event

For each `socket.on()` handler, add a shadow dispatch call **after** the V1 logic:

#### Example: request-join

**Before:**

```typescript
socket.on("request-join", ({ name, avatarId }) => {
  // V1 logic
  const claimed = claimAvatar(avatarId);
  if (!claimed) {
    socket.emit("join-rejected", { reason: "Avatar taken" });
    return;
  }

  users.set(socket.id, {
    name,
    avatarId,
    state: "regular",
    // ...
  });

  io.emit("user-list", Array.from(users.values()));
  // ... more V1 logic
});
```

**After:**

```typescript
socket.on("request-join", ({ name, avatarId }) => {
  // V1 logic (unchanged)
  const claimed = claimAvatar(avatarId);
  if (!claimed) {
    socket.emit("join-rejected", { reason: "Avatar taken" });
    return;
  }

  users.set(socket.id, {
    name,
    avatarId,
    state: "regular",
    // ...
  });

  io.emit("user-list", Array.from(users.values()));
  // ... more V1 logic

  // ✨ V2 SHADOW (NEW) ✨
  try {
    const roomId = extractRoomId(socket, { name, avatarId });
    const userId = extractUserId(socket, { name, avatarId });
    const action = mapLegacyToV2Action("request-join", { name, avatarId });
    shadowDispatch(roomId, userId, action);
  } catch (error) {
    // Swallow errors, don't break V1
    console.error("[Shadow] Failed:", error);
  }
});
```

---

## 🎯 Quick Integration Template

Use this template for each socket event:

```typescript
socket.on("EVENT_NAME", (payload) => {
  // ======================================
  // V1 LOGIC (UNCHANGED)
  // ======================================
  // ... existing code ...

  // ======================================
  // V2 SHADOW (NEW)
  // ======================================
  try {
    const roomId = extractRoomId(socket, payload);
    const userId = extractUserId(socket, payload);
    const action = mapLegacyToV2Action("EVENT_NAME", payload);
    shadowDispatch(roomId, userId, action);
  } catch (error) {
    console.error("[Shadow] Failed:", error);
  }
});
```

---

## 📋 Events to Hook (Priority Order)

### Priority 1: Session Lifecycle (Hook These First)

- [ ] `request-join` → JOIN_SESSION
- [ ] `disconnect` → DISCONNECT
- [ ] `leave` → LEAVE_SESSION

### Priority 2: Core Protocol

- [ ] `pointing` → POINT_TO_USER
- [ ] `start-session` → CLICK_READY_TO_GLOW

### Priority 3: Mic Control

- [ ] `drop-mic` → DROP_MIC
- [ ] `pass-mic` → PASS_MIC
- [ ] `accept-mic` → ACCEPT_MIC
- [ ] `decline-mic` → DECLINE_MIC

### Priority 4: Communication

- [ ] `send-gesture` → SEND_GESTURE
- [ ] `text-input` → TEXT_INPUT

---

## 🔍 Testing Shadow Mode

### Step 1: Enable Shadow Mode

Set environment variable:

```bash
export ENGINE_V2_SHADOW=true
npm run dev
```

Or in code:

```typescript
// At server startup
import { enableShadowMode } from "./engine-v2/shadow/shadowDispatcher";
enableShadowMode();
```

### Step 2: Monitor Logs

Start a session and watch console for:

```
[V2 Shadow] 🔍 Shadow mode ENABLED - V2 running as passive observer
```

Then look for action logs:

```
[V2 Shadow] default-room | user-abc123 | JOIN_SESSION
  Phase: LOBBY → LOBBY
  Speaker: none → none
  Connected: 0 → 1
  Ghosts: 0 → 0
  Effects: 2
  Invariants: ✅ OK
```

### Step 3: Validate No Errors

Run a full session (10 minutes):

- Join users
- Point to each other
- Achieve consensus
- Speak
- Disconnect/reconnect
- Send gestures

**Expected:** No `❌ ERROR` logs, only `✅ OK` invariants.

---

## 🚨 Common Issues

### Issue 1: "Cannot find module './engine-v2/shadow/shadowDispatcher'"

**Solution:** Check import path. Should be relative to `socketHandler.ts`:

```typescript
import { shadowDispatch } from "./engine-v2/shadow/shadowDispatcher";
```

### Issue 2: "Invariant violation" errors

**Good!** This means V2 caught a state inconsistency.

**Action:**

1. Check the error message (which invariant failed)
2. Check the action that triggered it
3. This is valuable feedback for fixing V2 transitions

### Issue 3: Too much log spam

**Solution:** Add a rate limiter:

```typescript
let lastLogTime = 0;
const MIN_LOG_INTERVAL = 1000; // 1 second

function shouldLog(): boolean {
  const now = Date.now();
  if (now - lastLogTime < MIN_LOG_INTERVAL) {
    return false;
  }
  lastLogTime = now;
  return true;
}
```

---

## ✅ Validation Checklist

After integrating shadow mode, validate:

- [ ] Server starts without errors
- [ ] Shadow mode logs appear on first action
- [ ] No V1 behavior changes (users can join/point/speak normally)
- [ ] V2 logs show state transitions
- [ ] Room isolation works (if testing multiple rooms later)
- [ ] No memory leaks after 1 hour runtime

---

## 🎯 Next Steps After Shadow Integration

Once shadow mode runs cleanly for 10 minutes:

1. **Implement JOIN_SESSION transition**
   - File: `reducer/transitions/join.ts`
   - Shadow logs should show participants being added

2. **Implement DISCONNECT transition**
   - File: `reducer/transitions/disconnect.ts`
   - Shadow logs should show ghost presence

3. **Implement RECONNECT transition**
   - File: `reducer/transitions/reconnect.ts`
   - Shadow logs should show ghost → connected

4. **Implement POINT_TO_USER transition**
   - File: `reducer/transitions/pointToUser.ts`
   - Shadow logs should show pointer updates

5. **Implement EVALUATE_SYNC transition**
   - File: `reducer/transitions/evaluateSync.ts`
   - Shadow logs should show consensus → SYNC_PAUSE → LIVE_SPEAKER

When all transitions are implemented, shadow logs will show the **full session flow**.

---

## 🫡 Ready to Deploy

Shadow mode is:

- ✅ Non-invasive (doesn't touch V1)
- ✅ Safe (errors are caught and logged)
- ✅ Informative (shows V2 state transitions)
- ✅ Zero risk (effects not executed)

**Deploy shadow mode now.** Learn from real traffic. Build transitions with confidence. 🚀

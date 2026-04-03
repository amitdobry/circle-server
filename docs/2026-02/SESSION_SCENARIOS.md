# 📋 SESSION SCENARIOS: Complete Flow Documentation

**Purpose:** Document exact session flows with real event names and state mutations  
**Status:** 🚧 In Progress - Feb 17, 2026  
**Methodology:** No assumptions - trace what the system does today

---

## 🎯 SCENARIO 1: Basic Speaking Flow

**Scope:** 4 users joined → Ron Ready to Glow → Consensus → Ron speaks → Dan gestures

**Participants:** Ron, Amit, Dan, Paul (all already in session)

---

### INITIAL STATE (Before Ron Acts)

**Server State:**
```typescript
// socketHandler.ts globals (⚠️ not room-scoped yet)
users: Map {
  "socket-1" => { socketId: "socket-1", name: "Ron", avatarId: "Pharaoh", state: "regular" }
  "socket-2" => { socketId: "socket-2", name: "Amit", avatarId: "Monk", state: "regular" }
  "socket-3" => { socketId: "socket-3", name: "Dan", avatarId: "Ninja", state: "regular" }
  "socket-4" => { socketId: "socket-4", name: "Paul", avatarId: "Pirate", state: "regular" }
}

pointerMap: Map {} // empty

liveSpeaker: null

sessionActive: true
sessionStartTime: [timestamp]
sessionTimer: [NodeJS.Timeout]

gliffMemory: [] // empty log
```

**All Clients See:**
- Panel: Attention/waiting panel (no active speaker)
- Timer: 60:00 counting down
- Avatars: All 4 in circle, no one highlighted

---

## STEP 1: Ron Clicks "Ready to Glow"

### Client Action (Ron's Browser)

**Event Emitted:**
```typescript
socket.emit("clientEmits", {
  actionType: "clickMouth", // or "readyToGlow" - TBD verify actual name
  name: "Ron",
  type: "action" // or other type
});
```

**📝 TODO: Verify exact actionType from client code**

---

### Server Processing

**Handler:** `handleClickMouth.ts` (or equivalent)

**State Mutations:**
```typescript
// BEFORE:
users.get("socket-1").state === "regular"

// AFTER:
users.get("socket-1").state = "hasClickedMouth"

// Pointer mutation (Question: Does Ron auto-point to self?)
// Option A: Ron points to self
pointerMap.set("Ron", "Ron")

// Option B: Ron doesn't point yet
// [UNDEFINED - needs clarification]
```

**Broadcasts Sent:**
```typescript
// ⚠️ Currently using io.emit (should be io.to(roomId))

// 1. Send updated user list to all
io.emit("user-list", Array.from(users.values()));

// 2. Trigger panel updates for all users
for (const [socketId, user] of users.entries()) {
  const panelConfig = getPanelConfigFor(user.name);
  io.to(socketId).emit("receive:panelConfig", panelConfig);
}

// Note: evaluateSync() is called, but no consensus yet
```

---

### Client Rendering (After Ron's Click)

**Ron's Panel:**
```typescript
// Panel config received (expected):
{
  panelType: "pickerPanel" | "hasClickedMouthPanel", // TBD exact type
  message: "You wish to speak. Waiting for others to align.",
  buttons: [
    { label: "Cancel", actionType: "cancelMouth" } // if exists?
  ]
}
```

**Amit's Panel:**
```typescript
{
  panelType: "pickerPanel",
  message: "Choose one to listen to. When all align a voice is born.",
  buttons: [
    { label: "Ron", actionType: "pointToUser", targetUser: "Ron" },
    { label: "Amit", actionType: "readyToGlow" }, // can also express wish?
    { label: "Dan", actionType: "pointToUser", targetUser: "Dan" },
    { label: "Paul", actionType: "pointToUser", targetUser: "Paul" }
  ]
}
```

**Dan's Panel:** (Same as Amit)

**Paul's Panel:** (Same as Amit)

**Visual Updates:**
- Ron's avatar: Highlighted or indicator showing "wants to speak"
- Green pointer line: Ron → Ron? (if self-pointing)
- Message appears: "Ron wishes to speak" (where? center panel? notification bar?)

---

## STEP 2: Amit Points to Ron

### Client Action (Amit's Browser)

**Event Emitted:**
```typescript
socket.emit("clientEmits", {
  actionType: "pointToUser",
  name: "Amit",
  targetUser: "Ron",
  type: "action"
});
```

---

### Server Processing

**Handler:** `handlePointToUser.ts`

**State Mutations:**
```typescript
// Pointer map update
pointerMap.set("Amit", "Ron");

// No user state change (Amit stays "regular")

// Consensus check via evaluateSync()
const votes = new Map<string, number>();
for (const target of pointerMap.values()) {
  votes.set(target, (votes.get(target) || 0) + 1);
}

// Ron has 1 vote (Amit)
// Need 4/4 for consensus → not reached
```

**Broadcasts Sent:**
```typescript
// Update pointer visualization
io.emit("update-pointing", {
  from: "Amit",
  to: "Ron"
});

// Potentially re-send panel configs (if picker UI shows vote counts)
```

---

### Client Rendering

**All Users See:**
- Green dotted line: Amit → Ron
- Vote count indicator? (if shown in UI)
- Waiting for others to align

---

## STEP 3: Dan Points to Ron

### Client Action

```typescript
socket.emit("clientEmits", {
  actionType: "pointToUser",
  name: "Dan",
  targetUser: "Ron"
});
```

### Server Processing

```typescript
pointerMap.set("Dan", "Ron");

// evaluateSync():
// Ron: 2 votes (Amit, Dan)
// Still need 4/4 → not reached
```

**Broadcasts:** Same pattern (update-pointing, panel configs)

---

## STEP 4: Paul Points to Ron → **CONSENSUS ACHIEVED**

### Client Action

```typescript
socket.emit("clientEmits", {
  actionType: "pointToUser",
  name: "Paul",
  targetUser: "Ron"
});
```

---

### Server Processing

**Handler:** `handlePointToUser.ts`

**State Mutations:**
```typescript
// Pointer update
pointerMap.set("Paul", "Ron");

// evaluateSync() called:
const votes = new Map<string, number>();
for (const target of pointerMap.values()) {
  votes.set(target, (votes.get(target) || 0) + 1);
}

// Count participants
const totalParticipants = users.size; // 4

// Check consensus
for (const [candidate, count] of votes.entries()) {
  if (count === totalParticipants) { // 4 === 4 ✅
    // CONSENSUS REACHED!
    
    // 1. Enter sync pause mode
    isSyncPauseMode = true;
    
    // 2. Set live speaker
    liveSpeaker = candidate; // "Ron"
    
    // 3. Update Ron's state
    const ronUser = Array.from(users.values()).find(u => u.name === "Ron");
    ronUser.state = "speaking";
    
    // 4. Brief pause (2-3 seconds)
    setTimeout(() => {
      isSyncPauseMode = false;
      // Send final panel configs
      broadcastPanelConfigs();
    }, 2500);
    
    break;
  }
}
```

**🚨 CRITICAL QUESTION: Does consensus count require Ron's self-pointer?**

**Scenario A:** Ron points to self
- Votes: Ron(1) + Amit(1) + Dan(1) + Paul(1) = 4/4 ✅

**Scenario B:** Ron doesn't point (or points to null)
- Votes: Amit(1) + Dan(1) + Paul(1) = 3/4 ❌
- **This creates deadlock!**

**📝 TODO: Verify actual behavior in evaluateSync() code**

---

### Server Broadcasts (Sync Pause Phase)

```typescript
// During isSyncPauseMode = true (2-3 seconds)

// 1. Notify all: sync achieved
io.emit("sync-achieved", {
  speaker: "Ron",
  message: "All aligned on Ron"
});

// 2. Send panel configs showing sync state
// (All users see "Sync moment" animation or freeze)

// 3. After timeout, send final speaker/listener panels
```

---

### Client Rendering (Sync Pause)

**All Users See:**
- Sync animation/visual effect (2-3 seconds)
- Message: "All aligned on Ron" or similar
- Green lines converging on Ron's avatar
- Possible audio/visual celebration

---

## STEP 5: Ron Becomes Live Speaker (After Sync Pause)

### Server State (After Timeout)

```typescript
isSyncPauseMode = false;
liveSpeaker = "Ron";

users.get("socket-1").state = "speaking";
users.get("socket-2").state = "regular"; // Amit
users.get("socket-3").state = "regular"; // Dan
users.get("socket-4").state = "regular"; // Paul
```

**Panel Configs Sent:**

**Ron's Panel (Speaker):**
```typescript
{
  panelType: "speakerPanel",
  header: "🎤 You are LIVE!",
  message: "i am now talking...", // text input field
  controls: [
    { type: "dropMic", label: "Drop the Mic" },
    { type: "passMic", label: "Pass the Mic" }
  ],
  gestures: [] // speakers don't send gestures to themselves
}
```

**Amit/Dan/Paul's Panels (Listeners):**
```typescript
{
  panelType: "listenerSyncPanel",
  speaker: "Ron",
  message: "Ron is speaking",
  controls: [],
  gestures: [
    { type: "earGesture", label: "I feel you", emoji: "💚", gestureCode: "feelYou" },
    { type: "earGesture", label: "I'm confused", emoji: "😕", gestureCode: "confused" },
    { type: "earGesture", label: "Not feeling it", emoji: "💔", gestureCode: "notFeeling" },
    { type: "blueGesture", label: "I'd love to hear...", emoji: "🔵" }
  ]
}
```

---

### Client Rendering (Live Speaking State)

**Ron's View:**
- LIVE badge on avatar
- Center panel shows text input
- Can type messages
- Controls: Drop Mic, Pass Mic buttons

**Amit/Dan/Paul's View:**
- Ron's avatar highlighted with LIVE badge
- Green pointer lines: Self → Ron
- Center panel shows Ron's messages as he types
- Gesture buttons available
- Bottom notification area for gesture feedback

---

## STEP 6: Ron Types Message

### Client Action (Ron's Browser)

**Every Keystroke Emits:**
```typescript
socket.emit("clientEmits", {
  actionType: "textInput",
  name: "Ron",
  content: "h", // single character
  type: "logBar"
});
```

**Then:**
```typescript
socket.emit("clientEmits", { content: "e" });
socket.emit("clientEmits", { content: "l" });
socket.emit("clientEmits", { content: "l" });
socket.emit("clientEmits", { content: "o" });
// ... etc
```

---

### Server Processing (Per Keystroke)

**Handler:** `handleTextInput.ts` (or routed to gliffLog)

**State Mutations:**
```typescript
// gliffLogService.ts
createGliffLog({
  userName: "Ron",
  message: {
    messageType: "textInput",
    content: "h",
    timestamp: Date.now()
  }
}, io);

// Inside createGliffLog:
const last = gliffMemory[gliffMemory.length - 1];

const canMerge = last && 
                 last.userName === "Ron" && 
                 last.message.messageType === "textInput";

if (canMerge) {
  // Append character to existing message
  last.message.content += "h";
  last.message.timestamp = Date.now();
} else {
  // Create new entry
  gliffMemory.push({
    userName: "Ron",
    message: {
      messageType: "textInput",
      content: "h",
      timestamp: Date.now()
    }
  });
}
```

**Broadcast (Per Keystroke):**
```typescript
// ⚠️ Global broadcast (should be room-scoped)
io.emit("gliffLog:update", gliffMemory);

// Also:
io.emit("logBar:update", {
  from: "Ron",
  char: "h"
});
```

---

### Client Rendering (Ron Types "hello")

**All Users See (Center Panel):**
```
Ron: h
Ron: he
Ron: hel
Ron: hell
Ron: hello
```

**Updated in real-time as Ron types.**

---

## STEP 7: Dan Sends "Reflect" Gesture

### Client Action (Dan's Browser)

```typescript
socket.emit("clientEmits", {
  actionType: "sendGesture",
  name: "Dan",
  gestureCode: "feelYou", // or "reflect"
  emoji: "🤝", // or "💚"
  targetUser: "Ron",
  type: "gesture"
});
```

---

### Server Processing

**Handler:** `handleSendGesture.ts`

**State Mutations:**
```typescript
// Add gesture to gliff log
createGliffLog({
  userName: "Dan",
  message: {
    messageType: "gesture",
    content: "I feel you",
    emoji: "🤝",
    timestamp: Date.now()
  }
}, io);

// Note: Gestures do NOT merge with text
// They create new entry, flushing the text buffer

// Trigger visual effect
console.log("🎆 Trigger effect: I feel you");

// Optional: emit gesture directly to Ron (speaker)
io.to(ronSocketId).emit("gestureReceived", {
  from: "Dan",
  gestureCode: "feelYou",
  emoji: "🤝"
});
```

**Broadcasts:**
```typescript
// 1. Update gliff log for all
io.emit("gliffLog:update", gliffMemory);

// 2. Visual effect trigger (possibly room-specific)
io.emit("gesture-effect", {
  from: "Dan",
  to: "Ron",
  emoji: "🤝"
});
```

---

### Client Rendering (After Dan's Gesture)

**Ron's View (Speaker):**
- Popup/tooltip appears: "Dan: 🤝 I feel you"
- Visual effect (particle/animation)
- Gesture appears in log/notification bar

**Dan's View (Sender):**
- Button highlights or changes to "Stop Reflecting"
- Confirmation that gesture was sent
- Possible visual feedback on his avatar

**Amit/Paul's View (Other Listeners):**
- See Dan's gesture in notification bar: "🤝 Dan says: 'I feel you'"
- Possibly see visual effect
- Gesture added to gliff log at bottom

**Gliff Log (All Users):**
```json
[
  {
    "userName": "Ron",
    "message": {
      "messageType": "textInput",
      "content": "hello",
      "timestamp": 1234567890
    }
  },
  {
    "userName": "Dan",
    "message": {
      "messageType": "gesture",
      "content": "I feel you",
      "emoji": "🤝",
      "timestamp": 1234567895
    }
  }
]
```

---

## 📊 STATE SUMMARY (End of Scenario 1)

### Server State

```typescript
users: Map {
  "socket-1" => { name: "Ron", state: "speaking" }
  "socket-2" => { name: "Amit", state: "regular" }
  "socket-3" => { name: "Dan", state: "regular" }
  "socket-4" => { name: "Paul", state: "regular" }
}

pointerMap: Map {
  "Ron" => "Ron", // if self-pointing
  "Amit" => "Ron",
  "Dan" => "Ron",
  "Paul" => "Ron"
}

liveSpeaker: "Ron"
isSyncPauseMode: false
sessionActive: true

gliffMemory: [
  { userName: "Ron", message: { messageType: "textInput", content: "hello", ... } },
  { userName: "Dan", message: { messageType: "gesture", content: "I feel you", emoji: "🤝", ... } }
]
```

---

## ⚠️ ROOM SCOPING NOTES

**Every broadcast in this scenario currently uses:**
```typescript
io.emit("event", data); // ❌ GLOBAL
```

**Must become:**
```typescript
io.to(roomId).emit("event", data); // ✅ ROOM-SCOPED
```

**Affected Broadcasts:**
- `user-list`
- `receive:panelConfig`
- `update-pointing`
- `sync-achieved`
- `gliffLog:update`
- `logBar:update`
- `gestureReceived`
- `gesture-effect`

**State that must be room-scoped:**
- `users` → `roomState.users`
- `pointerMap` → `roomState.pointerMap`
- `liveSpeaker` → `roomState.liveSpeaker`
- `gliffMemory` → `roomState.gliffLog`

---

## 🚨 FAILURE PATHS UNDER SCENARIO 1

### FAILURE 1: Late Join Mid-Pointing

**Scenario:** 
- Ron has clicked Ready to Glow
- Amit and Dan have pointed to Ron
- **NEW USER "John" joins mid-consensus**

**Current Behavior (Undefined):**

**Questions:**
1. Does John see Ron's "wish to speak" indicator?
2. Is John included in consensus count? (now need 5/5 instead of 4/4?)
3. Does John get a pointer automatically?
4. What panel does John see?

**Expected Behavior (To Define):**

**Option A: Include John in vote**
- Total participants: 5
- Need 5/5 for consensus
- John sees picker panel with Ron as option
- Consensus blocked until John also points

**Option B: Exclude John from current vote**
- Total participants: 4 (frozen at vote start)
- John sees "waiting" panel
- After Ron speaks/drops, John can participate

**📝 TODO: Define and document intended behavior**

---

### FAILURE 2: Pointer Change Before Lock

**Scenario:**
- Ron: wants to speak
- Amit → Ron
- Dan → Ron
- Paul → Ron (consensus about to lock)
- **But Amit changes mind: Amit → Dan BEFORE lock completes**

**Current Behavior:**

```typescript
// In evaluateSync():
// Votes recalculated every time pointerMap changes
// Ron: 2 votes (Dan, Paul)
// Dan: 1 vote (Amit)
// No consensus → Ron doesn't become speaker
```

**Questions:**
1. Is there a "lock window" where pointers freeze?
2. Can users always change pointers?
3. Does sync pause prevent pointer changes?

**Expected Behavior:**
- ✅ Pointer changes are allowed anytime before lock
- ✅ No "lock window" - dynamic voting
- ⚠️ Could lead to thrashing if users keep changing

**Mitigation (Optional):**
- Add pointer change cooldown (e.g., 500ms minimum between changes)
- Visual feedback showing "1 more needed for consensus"

---

### FAILURE 3: Ron Disconnect Before Lock

**Scenario:**
- Ron: wants to speak
- Amit → Ron, Dan → Ron, Paul → Ron
- **Ron's connection drops BEFORE consensus completes**

**Current Behavior:**

```typescript
socket.on("disconnect", () => {
  // Ron removed from users Map
  users.delete(ronSocketId);
  
  // Pointers to Ron become invalid
  // pointerMap still has: Amit → "Ron", Dan → "Ron", Paul → "Ron"
  // But "Ron" no longer exists in users
  
  // evaluateSync() called:
  // Does it handle non-existent targets?
});
```

**Questions:**
1. Are dangling pointers cleaned up?
2. What happens to users pointing to disconnected user?
3. Do they return to picker mode?

**Expected Behavior:**

```typescript
// On Ron disconnect:
1. Remove Ron from users Map
2. Clear all pointers TO Ron:
   for (const [from, to] of pointerMap.entries()) {
     if (to === "Ron") {
       pointerMap.delete(from);
     }
   }
3. Reset pointing users' states back to "regular"
4. Broadcast panel updates → all return to waiting/picker mode
5. Log: "Ron left - returning to selection"
```

**📝 TODO: Verify this cleanup exists in disconnect handler**

---

### FAILURE 4: Listener Disconnect at Lock Boundary

**Scenario:**
- Consensus achieved (4/4 votes for Ron)
- `isSyncPauseMode = true` (2-3 second animation)
- **During sync pause, Dan disconnects**

**Current Behavior:**

```typescript
// During sync pause:
setTimeout(() => {
  isSyncPauseMode = false;
  liveSpeaker = "Ron";
  broadcastPanelConfigs(); // Sends to all users in Map
}, 2500);

// If Dan disconnects at t=1000ms:
socket.on("disconnect", () => {
  users.delete(danSocketId);
  // But sync pause continues...
  // At t=2500ms, Ron becomes speaker
  // Dan is already gone, so no panel sent to him (OK)
});
```

**Questions:**
1. Does sync pause continue if participants drop?
2. Should consensus be re-evaluated mid-pause?
3. What if majority disconnects during pause?

**Expected Behavior:**

**Option A: Continue regardless**
- Sync pause completes
- Ron becomes speaker
- Remaining users (Amit, Paul) see Ron as speaker
- Dan missed it (already gone)

**Option B: Re-evaluate at pause end**
- Check if consensus still valid
- If too many left, abort and return to picker

**Option C: Cancel on ANY disconnect during pause**
- Sync animation stops
- All return to picker
- "Sync was broken" message

**📝 Recommended: Option A** (simplest, least disruptive)

---

## 🎯 UNDEFINED BEHAVIORS TO CLARIFY

### 1. **Self-Pointing Rule**

**Does Ron point to himself when he clicks "Ready to Glow"?**

**Impact:** Affects consensus math (3 others needed vs 4 needed)

**Test:**
```typescript
// After Ron clicks mouth:
console.log(pointerMap.get("Ron")); // "Ron" or undefined?
```

---

### 2. **Consensus Count Formula**

**Formula:**
```typescript
if (count === totalParticipants) { // What is totalParticipants?
  // Consensus!
}
```

**Options:**
- A: `users.size` (all connected users, including speaker)
- B: `users.size - 1` (exclude speaker from count)
- C: `pointerMap.size` (only users who have pointed)

**Current assumption:** Option A (all users must point)

**📝 TODO: Verify in evaluateSync() code**

---

### 3. **Pointer Visibility**

**Can users see who others are pointing to BEFORE consensus?**

**Evidence from screenshot:**
- Green dotted lines visible from Dan → Oren, Amit → Oren
- Suggests: YES, pointers are visible in real-time

**Benefit:** Creates social pressure, "1 more needed" is visible

**Risk:** Could create "pointer following" behavior (everyone copies first pointer)

---

### 4. **Gesture While Not Live**

**Can Amit send a gesture BEFORE Ron becomes live speaker?**

**Expected:** No (gestures only available in listener panel during active speaking)

**But what if:**
- Race condition: Amit's gesture emitted right as Ron becomes speaker?

**Server should validate:**
```typescript
if (!liveSpeaker) {
  return; // Reject gesture if no active speaker
}
```

---

## 📋 NEXT SCENARIO TO DOCUMENT

After S1 is validated, document:

**Scenario 2: Ron Drops the Mic**
- Ron speaking → Ron clicks "Drop the Mic" → Return to picker mode

**Scenario 3: Ron Passes the Mic (Blue Gesture)**
- Ron speaking → Ron clicks "Pass the Mic" → Selects Amit → Amit accepts → Amit becomes speaker

**Scenario 4: Multi-Candidate Picker**
- Ron + Amit both click "Ready to Glow" → Dan must choose between them

**Scenario 5: Session Timer Expires**
- Timer hits 0:00 during active speaking → Session ends → All users navigated

---

## ✅ VALIDATION CHECKLIST FOR SCENARIO 1

Before marking S1 complete:

- [ ] Verify exact `actionType` names from client code
- [ ] Confirm self-pointing behavior (Ron → Ron?)
- [ ] Confirm consensus formula (all users or all-except-speaker?)
- [ ] Verify pointer cleanup on disconnect
- [ ] Verify gesture validation (requires live speaker)
- [ ] Document actual panel config shapes received
- [ ] Add room-scoping notes to every broadcast
- [ ] Test all 4 failure paths
- [ ] Capture screenshots of each step
- [ ] Log actual server state at each step

---

**Status: SCENARIO 1 DRAFT COMPLETE**  
**Next: Validate against actual code and live testing**

**No code changes made. Pure documentation of existing behavior + gaps identified.**

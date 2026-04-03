# 🗺️ SOULCIRCLE SESSION FLOW: COMPLETE MAP

**Created:** February 17, 2026  
**Purpose:** Document every session scenario, state transition, and user perspective  
**Status:** 🚧 Work in Progress - Being filled incrementally through debugging

---

## 📋 TABLE OF CONTENTS

1. [Session States Overview](#session-states-overview)
2. [User State Machine (30+ States)](#user-state-machine)
3. [Session Scenarios](#session-scenarios)
4. [Panel Configurations by State](#panel-configurations-by-state)
5. [Edge Cases & Error States](#edge-cases--error-states)
6. [State Transition Map](#state-transition-map)

---

## 🎯 SESSION STATES OVERVIEW

### Core Session States

| Session State     | Description                                | Triggers                | Duration                 |
| ----------------- | ------------------------------------------ | ----------------------- | ------------------------ |
| `NOT_STARTED`     | No session active                          | Initial state           | Until first user joins   |
| `PICKER_MODE`     | Waiting for collective decision on speaker | 1+ users ready to speak | Until consensus          |
| `ACTIVE_SPEAKING` | Someone has the floor                      | All users point to one  | Until mic dropped/passed |
| `SYNC_PAUSE`      | Brief moment when sync achieved            | Consensus detected      | 2-3 seconds              |
| `SESSION_ENDED`   | Time's up, cleanup phase                   | Timer reaches 0:00      | Permanent                |

### User States (Complete List)

```
"regular"                    // Just joined, neutral state
"speaking"                   // Has the mic, is the live speaker
"thinking"                   // Clicked brain button
"waiting"                    // Waiting for something to happen
"hasClickedMouth"           // Clicked mouth, wants to speak
"hasClickedBrain"           // Clicked brain gesture
"hasClickedEar"             // Clicked ear gesture
"micIsDropped"              // Just dropped the mic
"hasDroppedTheMic"          // Confirmation state after drop
"isPassingTheMic"           // Initiating mic pass
"isPickingBlueSpeaker"      // Selecting target for blue gesture
"micOfferReceivedFromBlue"  // Received blue gesture offer
"acceptedBlueMic"           // Accepted blue gesture
"declinedBlueMic"           // Declined blue gesture
... (more to be documented)
```

---

## 🎬 SESSION SCENARIOS

### SCENARIO 1: Initial Join & Ready to Glow

**CASE 1A: Four Users Join Empty Table**

#### Initial State (Before Any Action)

**Session State:** `NOT_STARTED`  
**Timer:** Not visible or 60:00  
**Participants:** Ron, Amit, Dan, Paul

**Everyone's View:**

```
User: Ron
State: "regular"
Panel Type: [TO BE DOCUMENTED]
Available Actions:
  - ✨ "Ready to Glow" button (visible: YES/NO - TBD)
  - Other buttons: TBD
Sees: All 4 avatars in circle, no one highlighted
```

```
User: Amit
State: "regular"
Panel Type: [TO BE DOCUMENTED]
Available Actions: TBD
Sees: All 4 avatars in circle, no one highlighted
```

```
User: Dan
State: "regular"
Panel Type: [TO BE DOCUMENTED]
Available Actions: TBD
Sees: All 4 avatars in circle, no one highlighted
```

```
User: Paul
State: "regular"
Panel Type: [TO BE DOCUMENTED]
Available Actions: TBD
Sees: All 4 avatars in circle, no one highlighted
```

---

#### After Ron Clicks "Ready to Glow"

**Image Reference:** Screenshot #2  
**Observed:** "🎤 🎶 Ron wishes to speak"

**Session State:** `PICKER_MODE` (confirmed)  
**Timer:** Started (60:00 countdown)  
**Live Speaker:** `null`

**Ron's State Change:**

```
Before: "regular"
After: "hasClickedMouth" (assumed - TBD confirm)
```

**Ron's View (TO BE FILLED):**

```
Panel Type: ?
Message Shown: ?
Available Actions:
  - Can Ron cancel his wish to speak?
  - Can Ron click other gestures?
  - Can Ron point to others?
Buttons Visible: ?
Other Indicators: ?
```

---

**Amit's View (TO BE FILLED):**

```
Panel Type: ?
Message Shown: "Choose one to listen to. When all align a voice is born." (from screenshot)
Available Actions:
  - Three buttons visible: "Amit", "Dan", "Paul"
  - Can click to point to Ron? (button available?)
  - Can click "Ready to Glow" to also want to speak?
  - Can send gestures (ear/brain)?
  - Can initiate blue gesture?
Sees:
  - Ron's avatar: [highlighted? special indicator?]
  - Visual cue that Ron wants to speak: "🎤 🎶 Ron wishes to speak"
  - Other avatars: normal state
```

---

**Dan's View (TO BE FILLED):**

```
Panel Type: ?
Message Shown: ?
Available Actions:
  - Can point to Ron?
  - Can also click "Ready to Glow"?
  - Other options?
Sees:
  - Same as Amit?
  - Or different panel configuration?
```

---

**Paul's View (TO BE FILLED):**

```
Panel Type: ?
Message Shown: ?
Available Actions: ?
Sees: ?
```

---

#### Pointer State After Ron's Click

**Pointer Map:**

```
Ron → ? (points to self? null? TBD)
Amit → ? (not pointing yet)
Dan → ? (not pointing yet)
Paul → ? (not pointing yet)
```

**Questions to Answer:**

- Does Ron auto-point to himself?
- Do others have to explicitly click to point to Ron?
- What happens if someone clicks their own name instead?

---

### SCENARIO 1B: What If Amit Also Clicks "Ready to Glow"?

**BEFORE THIS ACTION:**

- Session State: `PICKER_MODE`
- Ron: wants to speak
- Amit: regular listener
- Dan: regular listener
- Paul: regular listener

**AMIT CLICKS "READY TO GLOW"**

**Amit's State Change:**

```
Before: "regular"
After: "hasClickedMouth"
```

**Session State:** Still `PICKER_MODE` (now 2 candidates)

**What Changes Globally?**

**Ron's View (TO BE DOCUMENTED):**

```
Message changes to: ?
Available Actions: ?
Can Ron now see Amit also wants to speak?
Can Ron point to Amit?
```

**Amit's View (TO BE DOCUMENTED):**

```
Message: ?
Can Amit see Ron wants to speak?
Can Amit point to Ron?
Can Amit cancel his own wish?
```

**Dan's View (TO BE DOCUMENTED):**

```
Message: "Choose one to listen to. When all align a voice is born."
Available Actions:
  - Button for Ron?
  - Button for Amit?
  - Button for Dan (himself)?
  - Button for Paul?
Sees: Visual indicators that Ron AND Amit both want to speak
```

**Paul's View (TO BE DOCUMENTED):**

```
Same as Dan? Or different?
```

**Pointer Map:**

```
Ron → ? (can point to Amit now?)
Amit → ? (can point to Ron now?)
Dan → ? (must choose Ron or Amit?)
Paul → ? (must choose Ron or Amit?)
```

---

### SCENARIO 1C: Consensus Achieved - Everyone Points to Ron

**BEFORE THIS ACTION:**

- Ron: wants to speak
- Amit, Dan, Paul: in picker mode

**POINTER MAP BECOMES:**

```
Ron → Ron (or self?)
Amit → Ron
Dan → Ron
Paul → Ron
```

**Consensus Detected:** 4/4 participants point to Ron

**Session State Transition:**

```
Before: PICKER_MODE
After: SYNC_PAUSE (brief moment)
Then: ACTIVE_SPEAKING
```

**Server Logic (evaluateSync):**

```javascript
// Votes tallied:
// Ron: 4 votes
// Consensus reached!
setLiveSpeaker("Ron");
setIsSyncPauseMode(true); // Brief pause
setTimeout(() => {
  setIsSyncPauseMode(false);
  // Ron becomes live speaker
}, 2000);
```

---

#### During SYNC_PAUSE (2-3 seconds)

**Ron's View (TO BE DOCUMENTED):**

```
Panel Type: ?
Message: Something about sync achieved?
Visual: Celebration animation?
Sees: ?
```

**Everyone Else's View (TO BE DOCUMENTED):**

```
Panel Type: ?
Message: ?
Visual effect showing consensus?
Sees: Ron highlighted as chosen?
```

---

#### After SYNC_PAUSE → Ron Becomes Speaker

**Session State:** `ACTIVE_SPEAKING`  
**Live Speaker:** Ron  
**Timer:** Continues countdown

**Ron's State:**

```
Before: "hasClickedMouth"
After: "speaking"
```

**Ron's Panel (SPEAKER PANEL):**

```
Panel Type: "speakerPanel"
Message: ?
Available Actions:
  - 🎤 Drop the Mic (button)
  - 🎤 Pass the Mic (blue gesture initiator)
  - Gesture buttons (ear/brain)?
  - Other controls?
Sees:
  - All listeners in circle
  - Visual indicator he's the speaker
  - Timer counting down
```

---

**Amit's Panel (LISTENER PANEL):**

```
Panel Type: "listenerSyncPanel" (assumed)
Message: ?
Available Actions:
  - Gesture buttons (ear responses, brain responses)
  - Blue gesture? (can offer mic to someone else?)
  - Point away from Ron? (break sync?)
Sees:
  - Ron highlighted as active speaker
  - Visual indicator of his own state
  - Other listeners
  - Timer
```

**Dan's Panel (TO BE DOCUMENTED):**

```
Same as Amit or different?
```

**Paul's Panel (TO BE DOCUMENTED):**

```
Same as Amit or different?
```

---

### SCENARIO 2: Speaker Actions While Speaking

#### SCENARIO 2A: Ron Drops the Mic

**BEFORE:**

- Ron: speaking
- Session State: ACTIVE_SPEAKING

**RON CLICKS "DROP THE MIC"**

**Ron's State Transition:**

```
Before: "speaking"
After: "micIsDropped" (then "hasDroppedTheMic"?)
```

**Session State Transition:**

```
Before: ACTIVE_SPEAKING
After: PICKER_MODE (back to selection)
Live Speaker: null
```

**Server Actions (TO BE DOCUMENTED):**

```javascript
// handleDropTheMic logic
// - Clear live speaker
// - Reset pointers?
// - Change Ron's state
// - Broadcast panel updates to all
```

**What Happens to Everyone?**

**Ron's View (TO BE DOCUMENTED):**

```
Panel changes to: ?
Message: ?
Available Actions: ?
Can Ron immediately click "Ready to Glow" again?
```

**Amit/Dan/Paul's View (TO BE DOCUMENTED):**

```
Panel changes to: ?
Message: ?
Back to picker mode UI?
Do they see notification "Ron dropped the mic"?
Can they now click "Ready to Glow"?
```

**Pointer State:**

```
Ron → ? (reset to null?)
Amit → ? (reset or stays pointing to Ron?)
Dan → ?
Paul → ?
```

---

#### SCENARIO 2B: Ron Initiates Blue Gesture (Pass the Mic)

**BEFORE:**

- Ron: speaking
- Session State: ACTIVE_SPEAKING

**RON CLICKS "PASS THE MIC" (Blue Gesture)**

**Ron's State Transition:**

```
Before: "speaking"
After: "isPickingBlueSpeaker"
```

**Ron's Panel Changes (TO BE DOCUMENTED):**

```
Panel Type: ?
Message: "Choose who to pass the flame to" (or similar?)
Available Actions:
  - Button for Amit
  - Button for Dan
  - Button for Paul
  - Cancel button? (TBD)
Sees: Selection interface
```

**Amit/Dan/Paul's View at This Moment (TO BE DOCUMENTED):**

```
Do they know Ron is picking someone?
Or no visual change yet?
Panel: Still listener panel?
Message: ?
```

---

#### After Ron Selects Amit for Blue Gesture

**RON CLICKS "AMIT" BUTTON**

**Server Actions:**

```javascript
// handleBlueOfferMicToUser logic
// - Change Amit's state to "micOfferReceivedFromBlue"
// - Store offer info (from: Ron, to: Amit)
// - Send panel updates
```

**Ron's State Transition:**

```
Before: "isPickingBlueSpeaker"
After: "speaking" (returns to speaking while waiting)
       OR "waiting" (waiting for Amit's response)?
       TBD
```

**Amit's State Transition:**

```
Before: "regular" (listener)
After: "micOfferReceivedFromBlue"
```

---

**Ron's View While Waiting (TO BE DOCUMENTED):**

```
Panel Type: ?
Message: "Waiting for Amit to respond" (or similar?)
Available Actions:
  - Can Ron cancel the offer?
  - Can Ron still drop the mic?
  - Can Ron send gestures?
  - Is Ron locked in waiting state?
Sees: ?
```

**Amit's View (Offer Received) (TO BE DOCUMENTED):**

```
Panel Type: Special offer panel
Message: "Ron wishes to pass you the flame" (or similar?)
Available Actions:
  - ✅ Accept button
  - ❌ Decline button
  - Timer on decision? (auto-decline after X seconds?)
Sees:
  - Ron highlighted as current speaker
  - Visual indicator of the offer
  - Other participants
```

**Dan's View (TO BE DOCUMENTED):**

```
Panel: Regular listener panel?
Message: Any notification about Ron's offer to Amit?
Sees: Visual indicator that something is happening between Ron & Amit?
```

**Paul's View (TO BE DOCUMENTED):**

```
Same as Dan or different?
```

---

#### Amit Accepts the Blue Gesture

**AMIT CLICKS "ACCEPT"**

**Amit's State Transition:**

```
Before: "micOfferReceivedFromBlue"
After: "acceptedBlueMic" (briefly?)
Then: "speaking" (becomes new speaker)
```

**Ron's State Transition:**

```
Before: "speaking" (or "waiting")
After: "regular" (becomes listener)
       OR "micIsDropped"?
       TBD
```

**Session State:**

```
Before: ACTIVE_SPEAKING (Ron was speaker)
After: ACTIVE_SPEAKING (Amit is now speaker)
Live Speaker: Changes from Ron → Amit
```

**Server Actions (TO BE DOCUMENTED):**

```javascript
// handleAcceptBlueMic or similar
// - Transfer speaker role
// - Update pointer map?
// - Change states
// - Broadcast panels
```

---

**Amit's New Panel (Now Speaker):**

```
Panel Type: speakerPanel
Message: ?
Available Actions:
  - Drop the Mic
  - Pass the Mic (blue gesture)
  - Gestures
Sees: Now in speaker position
```

**Ron's New Panel (Now Listener):**

```
Panel Type: listenerSyncPanel
Message: ?
Available Actions: Listener actions
Sees: Amit is now the speaker
```

**Dan & Paul's View (TO BE DOCUMENTED):**

```
What changes for them?
Do they see transition animation?
Message about speaker change?
Panel updates?
```

**Pointer State After Transfer (TO BE DOCUMENTED):**

```
Ron → ? (still points to self? resets?)
Amit → ? (points to self now?)
Dan → ? (auto-updates to Amit?)
Paul → ? (auto-updates to Amit?)

Do pointers auto-update to new speaker?
Or do they reset?
```

---

#### Amit Declines the Blue Gesture

**AMIT CLICKS "DECLINE"**

**Amit's State Transition:**

```
Before: "micOfferReceivedFromBlue"
After: "declinedBlueMic" (briefly?)
Then: "regular" (back to listener)
```

**Ron's State Transition:**

```
Before: "waiting" (if was waiting)
After: "speaking" (resumes speaking)
```

**Session State:**

```
No change: ACTIVE_SPEAKING (Ron still speaker)
Live Speaker: Still Ron
```

**Server Actions (TO BE DOCUMENTED):**

```javascript
// handleDeclineBlueMic or similar
// - Clear offer state
// - Return both to previous states
// - Send notifications?
```

**Amit's Panel After Decline:**

```
Panel Type: listenerSyncPanel (back to normal)
Message: ?
Sees: Returns to regular listener view
```

**Ron's Panel After Decline (TO BE DOCUMENTED):**

```
Panel Type: speakerPanel (still speaking)
Message: Notification that Amit declined?
Available Actions: Back to normal speaker actions
  - Can Ron immediately try blue gesture to someone else?
  - Or cooldown period?
```

**Dan & Paul's View (TO BE DOCUMENTED):**

```
Do they see that offer was declined?
Any notification?
```

---

### SCENARIO 3: Multiple Users Want to Speak Simultaneously

#### SCENARIO 3A: Three Users Click "Ready to Glow" Before Consensus

**SETUP:**

- Session State: PICKER_MODE
- Ron: already clicked "Ready to Glow"
- Then Amit clicks "Ready to Glow"
- Then Dan clicks "Ready to Glow"
- Paul: still regular, hasn't clicked

**States:**

```
Ron: "hasClickedMouth"
Amit: "hasClickedMouth"
Dan: "hasClickedMouth"
Paul: "regular"
```

**Paul's Panel (The Decider) (TO BE DOCUMENTED):**

```
Panel Type: ?
Message: "Choose one to listen to. When all align a voice is born."
Available Actions:
  - Button for Ron
  - Button for Amit
  - Button for Dan
  - Button for Paul (himself - can also join the wish to speak)
Sees: Three people want to speak, visual indicators for each
```

**Ron's Panel (Candidate) (TO BE DOCUMENTED):**

```
Panel Type: ?
Message: ?
Available Actions:
  - Can Ron see Amit and Dan also want to speak?
  - Can Ron point to Amit or Dan (give up his wish)?
  - Can Ron cancel his wish?
Sees: ?
```

**Amit's Panel (Candidate) (TO BE DOCUMENTED):**

```
Same as Ron or different?
Can candidates point to each other?
```

**Dan's Panel (Candidate) (TO BE DOCUMENTED):**

```
Same as Ron/Amit?
```

---

#### What if Paul Points to Amit?

**PAUL CLICKS "AMIT" BUTTON**

**Pointer Map:**

```
Ron → ? (still pointing to self or null?)
Amit → ? (pointing to self or null?)
Dan → ? (pointing to self or null?)
Paul → Amit
```

**Consensus Status:** NOT ACHIEVED (need 4/4)

**What Changes?**

**Paul's Panel (TO BE DOCUMENTED):**

```
After clicking Amit:
- Does Paul stay in selection mode?
- Can Paul change his vote?
- Does UI show "Waiting for others to align"?
```

**Amit's Perspective (TO BE DOCUMENTED):**

```
Does Amit see:
- "Paul is pointing to you" notification?
- Vote count (1/4 so far)?
- Visual indicator of Paul's support?
```

**Ron & Dan's Perspective (TO BE DOCUMENTED):**

```
Do they see:
- Paul pointed to Amit?
- Current vote distribution?
- Pressure to also point to Amit or defend their wish?
```

---

### SCENARIO 4: Session Timer Edge Cases

#### SCENARIO 4A: Timer Reaches 0:00 While Someone Speaking

**BEFORE:**

- Session State: ACTIVE_SPEAKING
- Live Speaker: Ron
- Timer: 0:03... 0:02... 0:01... 0:00

**WHEN TIMER HITS 0:00**

**Server Actions:**

```javascript
// Session end logic
// - Set session state to "ended"
// - Clear live speaker
// - Trigger cleanup
// - Navigate all users away?
```

**Session State:**

```
Before: ACTIVE_SPEAKING
After: SESSION_ENDED
```

---

**Everyone's View (TO BE DOCUMENTED):**

```
Panel Type: End screen?
Message: "Session has ended" or similar?
Available Actions:
  - Stay on page?
  - Auto-redirect to profile?
  - Join new session button?
  - View session summary?
Sees: ?
```

**Data Persistence (TO BE DOCUMENTED):**

```
What gets saved?
- Session duration
- Who spoke
- How many times
- Gesture counts?
- Any analytics?
```

---

#### SCENARIO 4B: Timer Reaches 0:00 During Picker Mode

**BEFORE:**

- Session State: PICKER_MODE
- Multiple users want to speak
- No consensus yet
- Timer: 0:00

**What Happens?**

**Does Session End Immediately? (TO BE DOCUMENTED)**

```
Option A: Hard stop, everyone kicked out
Option B: Grace period (30 seconds to reach consensus?)
Option C: Random speaker selected?
Which one is implemented?
```

---

#### SCENARIO 4C: Last 5 Minutes Warning

**TIMER: 5:00 remaining**

**What Changes? (TO BE DOCUMENTED)**

```
Visual indicators:
- Timer color changes?
- Warning message appears?
- Sound notification?

Behavior changes:
- Any restrictions on actions?
- Encouragement to wrap up?
```

---

### SCENARIO 5: User Disconnection Edge Cases

#### SCENARIO 5A: Speaker Disconnects Mid-Speech

**BEFORE:**

- Session State: ACTIVE_SPEAKING
- Live Speaker: Ron
- Listeners: Amit, Dan, Paul

**RON'S CONNECTION DROPS (closes browser/network issue)**

**Server Detection:**

```javascript
socket.on("disconnect", () => {
  // Ron disconnected
  // Is Ron the live speaker?
  if (liveSpeaker === "Ron") {
    // Handle speaker disconnect
  }
});
```

**Session State Transition (TO BE DOCUMENTED):**

```
Before: ACTIVE_SPEAKING (Ron speaking)
After: PICKER_MODE? (back to selection)
       OR ACTIVE_SPEAKING with auto-select new speaker?
       OR other?
Live Speaker: null? Or auto-assigned?
```

**Amit/Dan/Paul's View (TO BE DOCUMENTED):**

```
What do they see?
- "Ron has disconnected" notification?
- Immediate panel change to picker mode?
- Or smooth transition to new speaker?
- Who decides next speaker?
```

---

#### SCENARIO 5B: Listener Disconnects During Active Speaking

**BEFORE:**

- Live Speaker: Ron
- Listener: Amit disconnects

**Impact (TO BE DOCUMENTED):**

```
Does this affect:
- Pointer map (Amit's pointer removed?)
- Consensus calculation (fewer people needed now?)
- Ron's speaking session (continues unaffected?)
- Visual updates (Amit's avatar disappears from circle?)
```

---

#### SCENARIO 5C: User Disconnects Then Reconnects

**AMIT DISCONNECTS, THEN REJOINS 30 SECONDS LATER**

**Questions (TO BE DOCUMENTED):**

```
Does Amit:
- Return to same session?
- Keep same avatar?
- See current session state?
- Or start fresh as new user?

Authentication/Session Persistence:
- JWT token still valid?
- Socket reconnection logic?
- State recovery?
```

---

### SCENARIO 6: Gesture System Deep Dive

#### SCENARIO 6A: Listener Sends Ear Gesture While Ron Speaking

**BEFORE:**

- Ron: speaking
- Amit: listener, clicks ear gesture (e.g., "I agree" 👂)

**Amit's Action:**

```
Clicks: Ear button → selects specific gesture
```

**Server Actions (TO BE DOCUMENTED):**

```javascript
// handleEarGesture or similar
// - Store gesture event
// - Broadcast to Ron (the speaker)
// - Broadcast to other listeners?
// - Trigger visual feedback
```

---

**Ron's View (Speaker Receiving Gesture) (TO BE DOCUMENTED):**

```
Does Ron see:
- Popup/notification: "Amit: 👂 I agree"?
- Gesture queue (multiple gestures)?
- Visual indicator on Amit's avatar?
- Temporary or persistent display?
```

**Amit's View (Sender) (TO BE DOCUMENTED):**

```
After sending:
- Confirmation that gesture was sent?
- Visual feedback?
- Cooldown before next gesture?
- Can send multiple gestures rapidly?
```

**Dan & Paul's View (Other Listeners) (TO BE DOCUMENTED):**

```
Do they see Amit's gesture?
- Public gestures visible to all?
- Or private to speaker only?
```

---

#### SCENARIO 6B: Multiple Gestures Sent Simultaneously

**SETUP:**

- Ron: speaking
- Amit sends: 👂 "I agree"
- Dan sends: 🧠 "Let me think"
- Paul sends: 👄 "I disagree"

**Ron's View (TO BE DOCUMENTED):**

```
How are multiple gestures displayed?
- Queue system?
- All at once?
- Prioritization?
- Visual overflow handling?
```

---

### SCENARIO 7: Avatar and Identity

#### SCENARIO 7A: Two Users Try to Claim Same Avatar

**SETUP:**

- Ron joins, selects "Ninja" avatar
- Amit tries to join, also wants "Ninja" avatar

**Server Logic:**

```javascript
// Avatar claiming
const isAvatarTaken = Array.from(users.values()).some(
  (u) => u.avatarId === requestedAvatar
);

if (isAvatarTaken) {
  // Reject or force selection of different avatar
}
```

**Amit's Experience (TO BE DOCUMENTED):**

```
What happens:
- Error message: "Avatar already taken"?
- Avatar grayed out in selection UI?
- Forced to choose different avatar?
- Or both users can share avatars?
```

---

#### SCENARIO 7B: User Changes Name Mid-Session

**CAN USERS CHANGE NAMES DURING SESSION? (TO BE DOCUMENTED)**

```
Option A: Name locked after joining
Option B: Can change via profile/settings
Option C: No mechanism to change

If changeable:
- How does it affect pointer map?
- Do other users see update?
- Is history preserved?
```

---

## 🎛️ PANEL CONFIGURATIONS BY STATE

### Panel Type: Attention Panel

**When Shown:** User is not in session / not a participant

**Configuration (TO BE DOCUMENTED):**

```json
{
  "panelType": "attentionPanel",
  "message": "?",
  "buttons": [],
  "gestures": []
}
```

---

### Panel Type: Listener Sync Panel

**When Shown:** User is listener during active speaking

**Configuration (TO BE DOCUMENTED):**

```json
{
  "panelType": "listenerSyncPanel",
  "message": "?",
  "buttons": [],
  "gestures": [],
  "blueGestureAvailable": true/false
}
```

---

### Panel Type: Speaker Panel

**When Shown:** User is the live speaker

**Configuration (TO BE DOCUMENTED):**

```json
{
  "panelType": "speakerPanel",
  "message": "?",
  "controls": ["dropMic", "passMic", "gestures?"]
}
```

---

### Panel Type: Picker Panel

**When Shown:** Session in picker mode

**Configuration (TO BE DOCUMENTED):**

```json
{
  "panelType": "pickerPanel?",
  "message": "Choose one to listen to. When all align a voice is born.",
  "candidates": ["Ron", "Amit"],
  "userButtons": []
}
```

---

## 🚨 EDGE CASES & ERROR STATES

### Edge Case 1: All Users Want to Speak

**SCENARIO:**

- Ron: hasClickedMouth
- Amit: hasClickedMouth
- Dan: hasClickedMouth
- Paul: hasClickedMouth

**Problem:** No one can point to anyone else? Deadlock?

**Resolution (TO BE DOCUMENTED):**

```
Option A: All users can still point to others (cancel their own wish)
Option B: First one to cancel breaks deadlock
Option C: Timer-based random selection
Option D: ?
```

---

### Edge Case 2: Blue Gesture During Picker Mode

**SCENARIO:**

- Session in PICKER_MODE
- Ron wants to speak
- Amit (listener) tries to initiate blue gesture

**Question (TO BE DOCUMENTED):**

```
Can listeners initiate blue gestures during picker mode?
Or only when there's an active speaker?
```

---

### Edge Case 3: Rapid State Changes

**SCENARIO:**

- Ron drops mic
- Immediately clicks "Ready to Glow" again
- Before panel updates complete

**Potential Race Condition (TO BE DOCUMENTED):**

```
How does server handle rapid state changes?
- State machine lock?
- Event queue?
- Debouncing?
```

---

### Edge Case 4: Network Latency Differences

**SCENARIO:**

- Ron (fast connection): sees updates instantly
- Amit (slow connection): 2-second delay

**Consistency Issues (TO BE DOCUMENTED):**

```
Can users be in different states temporarily?
How is eventual consistency achieved?
What happens to stale clicks/actions?
```

---

## 🗺️ STATE TRANSITION MAP

### State Diagram: User States

```
[TO BE CREATED - Visual State Machine Diagram]

"regular"
  → clicks mouth → "hasClickedMouth"
  → clicks brain → "hasClickedBrain"
  → clicks ear → "hasClickedEar"
  → receives consensus → "speaking"

"hasClickedMouth"
  → consensus on them → "speaking"
  → consensus on other → "regular"
  → cancels wish → "regular"

"speaking"
  → drops mic → "micIsDropped" → "regular"
  → passes mic → "isPickingBlueSpeaker"
  → timer ends → "regular"

"isPickingBlueSpeaker"
  → selects target → "speaking" (waiting for response)
  → cancels → "speaking"

"micOfferReceivedFromBlue"
  → accepts → "acceptedBlueMic" → "speaking"
  → declines → "declinedBlueMic" → "regular"
  → timeout → "regular"

... (more transitions to map)
```

---

## 📊 DATA STRUCTURES

### Users Map Structure

```typescript
users: Map<socketId, UserInfo>;

interface UserInfo {
  socketId: string;
  name: string;
  avatarId: string;
  state: UserState; // 30+ possible states
  lastAction?: string;
  timestamp?: number;
}
```

---

### Pointer Map Structure

```typescript
pointerMap: Map<from: string, to: string>

// Example:
// "Ron" → "Amit"
// "Dan" → "Amit"
// "Paul" → "Amit"
// "Amit" → null (or self?)
```

---

### Session State Structure

```typescript
interface SessionState {
  isActive: boolean;
  startTime: number;
  duration: number; // milliseconds
  liveSpeaker: string | null;
  mode: "picker" | "active" | "sync_pause" | "ended";
  participants: string[]; // names
}
```

---

## 🔍 QUESTIONS TO ANSWER THROUGH DEBUGGING

### Critical Questions

1. **Pointer Behavior:**

   - Do users auto-point to themselves when they click "Ready to Glow"?
   - Can users change their pointer after clicking?
   - Do pointers reset after speaker drops mic?

2. **Blue Gesture Mechanics:**

   - Can speaker initiate multiple blue offers simultaneously?
   - What happens if blue offer target disconnects?
   - Is there a timeout on blue offers?
   - Can target still see offer after speaker drops mic?

3. **State Persistence:**

   - What happens to state on page refresh?
   - How long do disconnected users stay in session?
   - Is there session history/logging?

4. **Panel Caching:**

   - How does panel caching interact with rapid state changes?
   - Can stale panel configs cause issues?
   - What invalidates the cache?

5. **Consensus Algorithm:**

   - Exact logic for "all must point to one"?
   - Does unanimous mean including speaker pointing to self?
   - What if pointers are stale/inconsistent?

6. **Timer Behavior:**
   - Does timer pause during sync_pause?
   - Can timer be extended?
   - What happens at exactly 0:00 vs 0:00.5?

---

## 📝 DOCUMENTATION METHODOLOGY

### How We'll Fill This Document

1. **Live Debugging Sessions:**

   - Run local server + multiple client windows
   - Execute each scenario
   - Screenshot every state
   - Document exact panel configs received
   - Log all socket events

2. **Code Analysis:**

   - Read `socketHandler.ts` for server logic
   - Read `panelBuilderRouter.ts` for panel logic
   - Read action handlers for state transitions
   - Cross-reference with observations

3. **Verification:**
   - For each scenario, confirm:
     - Server state changes
     - Panel configs sent
     - UI displayed
     - User actions available
     - Edge case handling

---

## 🎯 NEXT STEPS

1. **Start Debugging Session 1:**

   - Scenario 1A: Four users join, one clicks "Ready to Glow"
   - Document all four perspectives
   - Capture panel configs
   - Map state transitions

2. **Continue Systematically:**

   - One scenario at a time
   - Fill in [TO BE DOCUMENTED] sections
   - Add screenshots
   - Verify against code

3. **Create Visual Aids:**
   - State machine diagram
   - Flow charts for complex scenarios
   - UI mockups with annotations

---

**STATUS: 🔴 LOCKED AND LOADED**

**READY TO START DEBUGGING AND MAPPING**

Let's fill this document together, scenario by scenario. 🚀

---

_This is a living document. Every debugging session adds clarity._  
_Every edge case discovered gets documented._  
_Every state transition gets mapped._

**The goal: Complete understanding of the entire session flow.**

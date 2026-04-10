# Session Summary: 2026-04-10

## Changes Made

---

### 1. File Logging (`index.ts`)
All `console.log/warn/error` output is now tee'd to `logs/server-YYYY-MM-DD.log`.  
New file per day, appended across restarts. `logs/` added to `.gitignore`.

---

### 2. Engine V2 Full Mode (`.env`)
Set `ENGINE_MODE=V2_FULL` and all individual feature flags to `true`, including `ENGINE_V2_SPEAKER_MANAGER=true`.

---

### 3. Phase B: SpeakerManager pulled from other machine
`server/engine-v2/managers/SpeakerManager.ts` and all Phase B handler updates were pulled from origin. Build passed, deployed to Heroku as v52.

---

### 4. Phase C: POINT_TO_USER + EVALUATE_SYNC wired in V2 reducer

**Files changed:**
- `server/engine-v2/state/selectors.ts` — Added `findParticipantByDisplayName()` and `getConnectedParticipantIds()`
- `server/engine-v2/state/types.ts` — Added `REBUILD_ALL_PANELS` effect type
- `server/engine-v2/shadow/actionMapper.ts` — Fixed `POINT_TO_USER` payload to include `from` field
- `server/engine-v2/reducer/reducer.ts` — Implemented `POINT_TO_USER`, `EVALUATE_SYNC`, `SET_LIVE_SPEAKER`
- `server/engine-v2/effects/runEffects.ts` — Added `REBUILD_ALL_PANELS` case

**Result:** V2 now correctly tracks pointers per room, detects consensus, and transitions to `LIVE_SPEAKER` phase.

---

### 5. 🐛 Critical Bug Fix: Reversed `setPointer`/`clearPointer` arguments (root cause of speaker panel never working)

**Root cause:** All 12 action handlers called `setPointer("default-room", from, to)` but the function signature is `setPointer(fromUser, toUser, roomId?)`. So `"default-room"` was stored as the `fromUser` and the actual user's name was used as the `roomId`. SpeakerManager's `"default-room"` map was always empty → `evaluateSync()` never saw any pointers → consensus never triggered → speaker panel never appeared.

**Files fixed:**
- `handlePointAtSpeaker.ts` — `setPointer(from, to)`
- `handleBreakSync.ts` — `setPointer(name, name)`
- `handleAcceptMicOfferFromPassTheMic.ts` — `setPointer(user.name, user.name)`
- `handleBlueSelectStart.ts` — `clearPointer(name)`
- `handleDisagree.ts` — `clearPointer(name)`
- `handleOfferMicToUserFromPassTheMic.ts` — `setPointer(name, targetUser)`
- `handleConcentNewSpeakerFromMicDroppedState.ts` — `setPointer(name, speakerCandidate)`
- `handleconcentNewSpeakerFromMicDropped.ts` — `setPointer(name, speakerCandidate)`
- `handleDeclineNewCandidateRequestAfterMicDropped.ts` — `clearPointer(user.name)`
- `handlePassTheMic.ts` — `clearPointer(name)` / `clearPointer(user.name)`
- `handleDeclineToSpeakAfterMicDropped.ts` — `clearPointer(user.name)` (×2)
- `handleDropTheMic.ts` — `clearPointer(name)` / `clearPointer(user.name)`

---

### 6. 🐛 Bug Fix: V2 invariant violation on disconnect

**Root cause:** When the last user disconnected during `LIVE_SPEAKER` phase, the reducer cleared `liveSpeaker` but left `phase = "LIVE_SPEAKER"`. The invariant checker correctly flagged this as invalid state.

**Fix:** `DISCONNECT` handler now sets `phase = "ATTENTION_SELECTION"` when clearing `liveSpeaker` due to all users becoming ghosts.

---

### 7. 🐛 Bug Fix: V2 stale participants between sessions

**Root cause:** V2's `RoomRegistry` held the `default-room` `TableState` indefinitely. When a new V1 session started with new users, V2 still had the old session's participants. `POINT_TO_USER` would log "could not resolve participants" because the new users (e.g. `123`, `234`, `345`) weren't in V2's map which still had `456`, `768`, `789`.

**Fix:** `endSession()` in `socketHandler.ts` now calls `roomRegistry.destroyRoom("default-room")` so V2 starts fresh with a clean participant map each session.

---

### 8. 🐛 Bug Fix: JOIN_SESSION blocked GHOST users' avatars being reclaimed

**Root cause:** The avatar conflict check in the `JOIN_SESSION` reducer case used `participant.presence !== "LEFT"`. This blocked new users from claiming avatars still held by GHOST participants (disconnected but not cleaned up), since GHOST `!== "LEFT"` is true.

**Fix:** Changed to `participant.presence === "CONNECTED"` in `reducer.ts` — only blocks avatars actively held by a connected user.

---

## State After This Session

| Area | Status |
|---|---|
| Speaker panel rendering | ✅ Should now work correctly |
| V2 POINT_TO_USER | ✅ Implemented and tracking |
| V2 EVALUATE_SYNC | ✅ Implemented |
| V2 invariant on disconnect | ✅ Fixed |
| V2 stale state between sessions | ✅ Fixed |
| Phase B argument bug | ✅ Fixed |
| JOIN_SESSION GHOST avatar block | ✅ Fixed |
| WishToSpeak pointer bypass SpeakerManager | ✅ Fixed |
| Build | ✅ Clean |
| Deployed to Heroku | ✅ v53 → v54 pending |

### 9. Panel Override Snapshot Logging

Added structured snapshot logs to detect V1/V2 panel override races.

**Files changed:**
- `server/panelConfigService.ts` — added `[PANEL-SNAPSHOT][V1]` log after every `panelBuilderRouter()` call
- `server/engine-v2/effects/runEffects.ts` — added `[PANEL-SNAPSHOT][V2]` log in `REBUILD_ALL_PANELS` case (reads live `TableState` from `roomRegistry`)
- `server/socketHandler.ts` — added `[PANEL-SNAPSHOT][V1-SYNC]` log at start of `evaluateSync()` rebuild loop

**Log format:**
```
[PANEL-SNAPSHOT][V1] user=Amit panelType=speaker liveSpeaker=Amit isSyncPauseMode=false participants=3 pointerMap={Yoni→Amit, Tal→Amit, Amit→Amit}
[PANEL-SNAPSHOT][V2] room=default-room phase=LIVE_SPEAKER liveSpeaker=Amit connected=[Yoni, Tal, Amit] pointerMap={userId1→userId2, ...}
[PANEL-SNAPSHOT][V1-SYNC] evaluateSync triggered panel rebuild for all users | newLiveSpeaker=Amit
```

**Race to look for:** if V2's `liveSpeaker` userId resolves to a different name than V1's `liveSpeaker` string, or if V1-SYNC fires _after_ a V2 snapshot, V1 is overriding V2's panel state.

---

### 10. 🐛 Bug Fix: `handleWishToSpeakAfterMicDropped` bypassing SpeakerManager

**Root cause:** When a dropped-mic user raised their hand to speak again, `handleWishToSpeakAfterMicDropped` wrote pointers directly to the legacy `pointerMap` object via `pointerMap.set()`. With `ENGINE_V2_SPEAKER_MANAGER=true`, `evaluateSync()` reads from `SpeakerManager.getPointerMap()` — which never received the candidate's self-pointer (`test2→test2`). After both listeners consented via `setPointer()`, SpeakerManager had `{test3→test2, test1→test2}` but was missing `test2→test2`, so consensus could never fire. The panel showed "You've requested to speak. Waiting for the group to sync with you..." indefinitely.

**Fix:** Replaced `pointerMap.set(user.name, ...)` / `pointerMap.set(user.name, null)` with `setPointer(user.name, name)` / `clearPointer(user.name)` in `handleWishToSpeakAfterMicDropped.ts`. Also removed the now-unused `pointerMap` destructure from context.

**File changed:** `server/actions/handlers/handleWishToSpeakAfterMicDropped.ts`

---

## Next: Phase D

Full plan: `docs/2026-04/PHASE_D_V2_FULL_OWNERSHIP_PLAN.md`

**Goal:** V2 becomes single source of truth — V1's `evaluateSync()`, legacy globals, and per-handler panel rebuilds are removed.

**9 steps, in order:**

| Step | What | Status |
|---|---|---|
| 1 | Wire `REBUILD_ALL_PANELS` to actually emit panels to all sockets | ❌ |
| 2 | `DROP_MIC` in V2 reducer | ❌ |
| 3 | `PASS_MIC` in V2 reducer | ❌ |
| 4 | `ACCEPT_MIC` / `DECLINE_MIC` in V2 reducer | ❌ |
| 5 | `LEAVE_SESSION` + `RECONNECT` in V2 reducer | ❌ |
| 6 | Wire `SOCKET_EMIT_USER` effect in runEffects | ❌ |
| 7 | **Remove V1 `evaluateSync()` + legacy globals** (the actual cutover) | ❌ |
| 8 | Wire `GLIFF_APPEND` effect | ❌ |
| 9 | `SEND_GESTURE` / `TEXT_INPUT` in V2 reducer | ❌ |

**What stays in V1 after Phase D:** per-user UI states (`user.state`), `panelConfigService`, `panelBuilderRouter`, gliff log writing.

**Phase E (future):** Model per-user UI states in V2 `ParticipantState`, FireKeeper joins as socket client, full removal of V1 action handlers.

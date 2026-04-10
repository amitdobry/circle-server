# Session Summary: 2026-04-10

## Overview

Long session covering code sync, Phase C implementation, 5 bug fixes found through live testing, snapshot logging infrastructure, and Phase D steps 1–6 (V2 full ownership of panel builds and mic lifecycle). Deployed to Heroku v54.

---

## Changes Made

---

### 1. File Logging (`index.ts`)
All `console.log/warn/error` output is now tee'd to `logs/server-YYYY-MM-DD.log`.  
New file per day, appended across restarts. `logs/` added to `.gitignore`.

---

### 2. Engine V2 Full Mode (`.env`)
Set `ENGINE_MODE=V2_FULL` and all individual feature flags to `true`, including `ENGINE_V2_SPEAKER_MANAGER=true`.

---

### 3. Phase B: SpeakerManager synced from other machine
`server/engine-v2/managers/SpeakerManager.ts` and all Phase B handler updates were pulled from origin. Build passed, deployed to Heroku as v52.

---

### 4. Phase C: POINT_TO_USER + EVALUATE_SYNC wired in V2 reducer

**Files changed:**
- `server/engine-v2/state/selectors.ts` — Added `findParticipantByDisplayName()` and `getConnectedParticipantIds()`
- `server/engine-v2/state/types.ts` — Added `REBUILD_ALL_PANELS` effect type
- `server/engine-v2/shadow/actionMapper.ts` — Fixed `POINT_TO_USER` payload to include `from` field
- `server/engine-v2/reducer/reducer.ts` — Implemented `POINT_TO_USER`, `EVALUATE_SYNC`, `SET_LIVE_SPEAKER`
- `server/engine-v2/effects/runEffects.ts` — Added `REBUILD_ALL_PANELS` case (logging only at this point)

**Result:** V2 now correctly tracks pointers per room, detects consensus, and transitions to `LIVE_SPEAKER` phase.

---

### 5. 🐛 Critical Bug Fix: Reversed `setPointer`/`clearPointer` arguments

**Root cause:** All 12 action handlers called `setPointer("default-room", from, to)` but the signature is `setPointer(fromUser, toUser, roomId?)`. `"default-room"` was stored as `fromUser`, the actual user name was used as `roomId`. SpeakerManager's `"default-room"` map was always empty → `evaluateSync()` never detected consensus → speaker panel never appeared.

**Files fixed (12):**
`handlePointAtSpeaker.ts`, `handleBreakSync.ts`, `handleAcceptMicOfferFromPassTheMic.ts`, `handleBlueSelectStart.ts`, `handleDisagree.ts`, `handleOfferMicToUserFromPassTheMic.ts`, `handleConcentNewSpeakerFromMicDroppedState.ts`, `handleconcentNewSpeakerFromMicDropped.ts`, `handleDeclineNewCandidateRequestAfterMicDropped.ts`, `handlePassTheMic.ts`, `handleDeclineToSpeakAfterMicDropped.ts`, `handleDropTheMic.ts`

---

### 6. 🐛 Bug Fix: V2 invariant violation on disconnect

**Root cause:** When the last user disconnected during `LIVE_SPEAKER` phase, reducer cleared `liveSpeaker` but left `phase = "LIVE_SPEAKER"` → invariant violation.

**Fix:** `DISCONNECT` case in `reducer.ts` now sets `phase = "ATTENTION_SELECTION"` when `liveSpeaker` is cleared.

---

### 7. 🐛 Bug Fix: V2 stale participants between sessions

**Root cause:** `RoomRegistry` kept `default-room` `TableState` indefinitely. New session users couldn't be resolved in `POINT_TO_USER` because V2 still tracked the previous session's participants.

**Fix:** `endSession()` in `socketHandler.ts` now calls `roomRegistry.destroyRoom("default-room")`.

---

### 8. 🐛 Bug Fix: JOIN_SESSION blocked GHOST users' avatars being reclaimed

**Root cause:** Avatar conflict check used `participant.presence !== "LEFT"` — blocked new users from claiming avatars still held by GHOST participants.

**Fix:** Changed to `participant.presence === "CONNECTED"` in `reducer.ts`.

---

### 9. Panel Override Snapshot Logging

Added structured snapshot logs to detect V1/V2 panel override races.

**Files changed:**
- `server/panelConfigService.ts` — `[PANEL-SNAPSHOT][V1]` after every `panelBuilderRouter()` call
- `server/engine-v2/effects/runEffects.ts` — `[PANEL-SNAPSHOT][V2]` in `REBUILD_ALL_PANELS` (reads live `TableState`)
- `server/socketHandler.ts` — `[PANEL-SNAPSHOT][V1-SYNC]` at start of `evaluateSync()` rebuild loop

**Log format:**
```
[PANEL-SNAPSHOT][V1] user=Amit panelType=speaker liveSpeaker=Amit isSyncPauseMode=false participants=3 pointerMap={Yoni→Amit, Tal→Amit, Amit→Amit}
[PANEL-SNAPSHOT][V2] room=default-room phase=LIVE_SPEAKER liveSpeaker=Amit connected=[Yoni, Tal, Amit] pointerMap={...}
[PANEL-SNAPSHOT][V1-SYNC] evaluateSync triggered panel rebuild for all users | newLiveSpeaker=Amit
```

---

### 10. 🐛 Bug Fix: `handleWishToSpeakAfterMicDropped` bypassing SpeakerManager

**Root cause:** Handler wrote pointers directly to the legacy `pointerMap` object via `pointerMap.set()`. With `ENGINE_V2_SPEAKER_MANAGER=true`, `evaluateSync()` reads from `SpeakerManager.getPointerMap()` — which never received the candidate's self-pointer. After both listeners consented, SpeakerManager had `{test3→test2, test1→test2}` but was missing `test2→test2` → consensus never fired → "Waiting for the group to sync with you..." indefinitely.

**Fix:** Replaced `pointerMap.set()`/`null` with `setPointer()`/`clearPointer()` in `handleWishToSpeakAfterMicDropped.ts`.

---

### 11. Phase D Step 1: `REBUILD_ALL_PANELS` now actually emits panels

**File:** `server/engine-v2/effects/runEffects.ts`

**Before:** Logged only — `"socketHandler should handle this"`.

**After:** Iterates all `CONNECTED` participants in `TableState`, calls `getPanelConfigFor(displayName)` for each, emits `receive:panelConfig` to their socketId directly.

**Significance:** V2 can now independently push correct panel state to all clients on every consensus/speaker-change event, without relying on V1's `evaluateSync()` to do the broadcast.

---

### 12. Phase D Steps 2–4: `DROP_MIC`, `PASS_MIC`, `ACCEPT_MIC`, `DECLINE_MIC` implemented in V2 reducer

**File:** `server/engine-v2/reducer/reducer.ts`

| Action | V2 State Change | Effects Emitted |
|---|---|---|
| `DROP_MIC` | `liveSpeaker=null`, `pointerMap.clear()`, `syncPause=true`, `phase=ATTENTION_SELECTION` | `live-speaker-cleared` + `REBUILD_ALL_PANELS` |
| `PASS_MIC` | Same as DROP_MIC | Same |
| `ACCEPT_MIC` | `liveSpeaker=userId`, `syncPause=false`, `phase=LIVE_SPEAKER` | `live-speaker` + `REBUILD_ALL_PANELS` |
| `DECLINE_MIC` | Deletes decliner's pointer from `pointerMap` | `REBUILD_ALL_PANELS` |

---

### 13. Phase D Step 5: `LEAVE_SESSION` + `RECONNECT` implemented in V2 reducer

**File:** `server/engine-v2/reducer/reducer.ts`

**`LEAVE_SESSION`:**
- Removes participant from `tableState.participants` entirely (vs DISCONNECT which keeps seat as GHOST)
- Clears their pointer and any pointers pointing TO them
- If they were `liveSpeaker`: clears speaker, resets phase to `ATTENTION_SELECTION`
- Emits `REBUILD_ALL_PANELS`

**`RECONNECT`:**
- Finds GHOST participant by `displayName` (from payload) or socketId
- Restores `presence = "CONNECTED"`, updates `socketId` to new connection
- Emits `v2:reconnect-state` to the rejoining socket (current phase + live speaker name)
- Emits `REBUILD_ALL_PANELS`

---

### 14. Phase D Step 6: `SOCKET_EMIT_USER`, `EMIT_FULL_STATE_TO_USER`, `EMIT_PANEL_CONFIG` wired in runEffects

**File:** `server/engine-v2/effects/runEffects.ts`

All three were no-op stubs. Now:

| Effect | Implementation |
|---|---|
| `SOCKET_EMIT_USER` | `io.to(userId).emit(event, data)` — userId = socketId in V2 |
| `EMIT_FULL_STATE_TO_USER` | `io.to(userId).emit("v2:full-state", snapshot)` |
| `EMIT_PANEL_CONFIG` | `io.to(userId).emit("receive:panelConfig", config)` |

---

## Final State

| Area | Status |
|---|---|
| Speaker panel on consensus | ✅ Working |
| V2 POINT_TO_USER / EVALUATE_SYNC | ✅ Implemented |
| V2 DROP_MIC / PASS_MIC | ✅ Implemented |
| V2 ACCEPT_MIC / DECLINE_MIC | ✅ Implemented |
| V2 LEAVE_SESSION / RECONNECT | ✅ Implemented |
| V2 REBUILD_ALL_PANELS emits panels | ✅ Implemented |
| V2 SOCKET_EMIT_USER / EMIT_PANEL_CONFIG | ✅ Wired |
| V2 invariant on disconnect | ✅ Fixed |
| V2 stale state between sessions | ✅ Fixed |
| Reversed setPointer args (12 handlers) | ✅ Fixed |
| WishToSpeak pointer bypass | ✅ Fixed |
| JOIN_SESSION GHOST avatar block | ✅ Fixed |
| Panel override snapshot logging | ✅ In place |
| Build | ✅ Clean |
| Deployed to Heroku | ✅ v54 |

---

## Phase D Remaining (Step 7+)

| Step | What | Status |
|---|---|---|
| 7 | Validate V2 panel emit works in production, compare with V1-SYNC logs | 🔄 Testing |
| 8 | Remove V1 `evaluateSync()` + legacy globals (`pointerMap`, `liveSpeaker`, `isSyncPauseMode`) | ❌ |
| 9 | Wire `GLIFF_APPEND` effect | ❌ |
| 10 | `SEND_GESTURE` / `TEXT_INPUT` in V2 reducer | ❌ |

**Full plan:** `docs/2026-04/PHASE_D_V2_FULL_OWNERSHIP_PLAN.md`

**Phase E (future):** Model per-user UI states in V2 `ParticipantState`, FireKeeper joins as socket client, full removal of V1 action handlers.

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

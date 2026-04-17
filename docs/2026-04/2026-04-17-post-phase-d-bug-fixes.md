# Post Phase D Bug Fixes — April 17, 2026

## Context

Continuation of the April 10 session. Phase D (V2 full ownership) was complete and deployed as Heroku v57. This session was a live-testing day — walking through every speaker flow and fixing the bugs found.

---

## Root Cause Pattern (applies to ALL bugs below)

When `evaluateSync()` was removed in Phase D Step 8, it took with it an implicit side effect that every handler was silently relying on.

**The old implicit behavior:**
Every time a handler called `setPointer()` or changed state, `evaluateSync()` would fire and re-scan `SpeakerManager.pointerMap`. If it detected broken consensus, it called `setLiveSpeaker(null)` automatically.

**What broke:**
Any handler that changes state mid-flow (interrupt, pass mic, decline, etc.) was relying on `evaluateSync` to clear `liveSpeaker`. Without it, `liveSpeaker` stayed set → `panelBuilderRouter` kept routing the ex-speaker to `buildSpeakerPanel` → no case for the new state → fell through to `state-live` (the "You are LIVE!" panel).

**The fix pattern (same for all):**
Add an explicit `setLiveSpeaker(null)` call at the point where the speaker's authority ends.

---

## Bugs Fixed

---

### Bug 7 — Interrupt → Choose Speaker → Accept: Ex-speaker got wrong panel

**Flow:** 234 is live → 123 clicks interrupt (Brain/Mouth) → 123 clicks "Hear more voices" (blue select) → 123 picks 456 → 456 accepts

**Symptom:** After 456 accepted, 234 received `state-live` ("You are LIVE!") instead of `state-7` (Consent panel).

**Root cause (two parts):**

**Part A:** `handleOfferMicToUserFromPassTheMic` — when 123 picked 456, it called `setPointer(123, 456)` which visually broke consensus, but never called `setLiveSpeaker(null)`. So 234 remained `liveSpeaker` → routed to `buildSpeakerPanel` → state `awaitingUserMicOfferResolutionFromPassTheMic` had no case → `state-live`.

**Fix:** Added `setLiveSpeaker(null)` in `handleOfferMicToUserFromPassTheMic` after the pointer update.

**Part B:** `handleConcentNewSpeakerFromMicDroppedState` — when the final consent was given, V2's pointerMap was stale (the entire consent flow used server-side `setPointer()` calls, never `POINT_TO_USER` socket events). V2 never saw the pointer updates and never fired `EVALUATE_SYNC` / `REBUILD_ALL_PANELS`.

**Fix:** Added explicit consensus detection in `handleConcentNewSpeakerFromMicDroppedState`:
1. Count remaining `appendingConcentToPickUpTheMic` users
2. When `remainingConsenters === 0`: reset V1 user states to `speaking`/`regular`, call `setLiveSpeaker()` + `setIsSyncPauseMode(false)`, then dispatch `ACCEPT_MIC` to V2 which fires `REBUILD_ALL_PANELS` → emits panels to all clients

**Files changed:**
- `server/actions/handlers/handleOfferMicToUserFromPassTheMic.ts`
- `server/actions/handlers/handleConcentNewSpeakerFromMicDroppedState.ts`

---

### Bug 8 — Pass Mic → Choose Speaker: Speaker got "You are LIVE!" instead of participant picker

**Flow:** 456 is live → clicks "Pass the Mic" → "Who do you want to invite?" panel appears with "Offer to Circle" / "Choose a Speaker" → clicks "Choose a Speaker"

**Symptom:** After clicking "Choose a Speaker", 456 received `state-live` instead of `state-13` (participant name buttons).

**Root cause:** `handleOpenChooseASpeakerFromPassTheMic` set 456's state to `isChoosingUserToPassMic` but never called `setLiveSpeaker(null)`. `liveSpeaker` was still 456 → `isUserSpeaker = true` → `panelBuilderRouter` → `buildSpeakerPanel` → no case for `isChoosingUserToPassMic` → `state-live`.

`listenersPanelBuilder` already had `state-13` for `isChoosingUserToPassMic` (participant picker with one button per other user). It was simply unreachable for the speaker.

**Fix:** Added `setLiveSpeaker(null)` in `handleOpenChooseASpeakerFromPassTheMic`. With `liveSpeaker=null` and `isSyncPauseMode=true`, router → `buildListenerSyncPanel` → `state-13` ✅

**File changed:** `server/actions/handlers/handleOpenChooseASpeakerFromPassTheMic.ts`

---

### Bug 9 — Drop the Mic / Pass the Mic: Speaker kept "You are LIVE!" panel

**Flow:** Any live speaker clicks "Drop the Mic" or "Pass the Mic"

**Symptom:** Speaker received `state-live` instead of `state-waiting-for-drop-the-mic` / `state-start-passing-mic`.

**Root cause:** Both `handleDropTheMic` and `handlePassTheMic` had `// setLiveSpeaker(null);` commented out — left over from the Phase D migration, waiting to be uncommented after testing.

**Fix:** Uncommented `setLiveSpeaker(null)` in both handlers.

**Files changed:**
- `server/actions/handlers/handleDropTheMic.ts`
- `server/actions/handlers/handlePassTheMic.ts`

---

### Bug 10 — Decline Mic Offer: Attention system stopped working after decline

**Flow:** 344343 is offered the mic by another participant → clicks "No, not now" → everyone goes to `regular` state → BUT clicking avatars to point no longer triggered consensus

**Symptom:** After a decline, the attention selector appeared to work visually (pointers drawn) but consensus was never detected — system stuck.

**Root cause:** `handleDeclineNewCandidateRequestAfterMicDropped` only called `clearPointer` for the decliner. All other users kept their old pointers from the consent round in `SpeakerManager.pointerMap` and V2's `TableState.pointerMap`. When a fresh `POINT_TO_USER` fired, V2's `evaluateConsensus()` checked the stale pointers and got confused.

Additionally, `setLiveSpeaker(null)` was never called, so if `liveSpeaker` was set, `panelBuilderRouter` kept routing to sync panels.

**Fix:** Clear all pointers (loop all users, `clearPointer` + emit `update-pointing null`), add `setLiveSpeaker(null)`, then `setIsSyncPauseMode(false)`. Mirrors exactly what `handleDisagree` does.

**File changed:** `server/actions/handlers/handleDeclineNewCandidateRequestAfterMicDropped.ts`

---

## The Complete List of Handlers That Needed `setLiveSpeaker(null)`

All of these had the call commented out or missing after Phase D Step 8:

| Handler | When liveSpeaker should clear |
|---|---|
| `handleDisagree` | Listener breaks sync after consensus ✅ fixed Apr 10 (v55) |
| `handleOfferMicToUserFromPassTheMic` | Interrupter picks a new candidate ✅ fixed Apr 10 (v57) |
| `handleOpenChooseASpeakerFromPassTheMic` | Speaker opens "choose who to pass to" ✅ fixed today |
| `handleDropTheMic` | Speaker drops the mic ✅ fixed today |
| `handlePassTheMic` | Speaker starts pass-mic flow ✅ fixed today |

---

## Summary of All Fixes by Root Cause

All 10 bugs fixed across Apr 10 + Apr 17 fall into two structural categories:

**Category A — Missing `setLiveSpeaker(null)` (evaluated implicitly by `evaluateSync` before):**
Bugs 5, 7 (part A), 8, 9, 10

**Category B — V2 pointerMap never updated by server-side flows:**
Bugs 2 (room not found), 7 (part B — consensus not detected after pass-mic accept), 3 (SpeakerManager out of sync with TableState)

---

## Files Changed Today

- `server/actions/handlers/handleOfferMicToUserFromPassTheMic.ts`
- `server/actions/handlers/handleConcentNewSpeakerFromMicDroppedState.ts`
- `server/actions/handlers/handleOpenChooseASpeakerFromPassTheMic.ts`
- `server/actions/handlers/handleDropTheMic.ts`
- `server/actions/handlers/handlePassTheMic.ts`
- `server/actions/handlers/handleDeclineNewCandidateRequestAfterMicDropped.ts`

---

## Deployments

| Version | Date | What changed |
|---|---|---|
| v57 | Apr 10 | handleOfferMicToUserFromPassTheMic + handleConcentNewSpeakerFromMicDroppedState fixes |
| v58 (pending) | Apr 17 | Bugs 8, 9, 10 fixes |

---

## Known Issues Still Remaining

See `2026-04-10-phase-d-completion.md` — the list from Apr 10 is unchanged. None of today's fixes touched the untested scenarios (mid-session join, speaker disconnect, multi-room, session timer, reconnect).

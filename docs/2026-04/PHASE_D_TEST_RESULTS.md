# Phase D Test Results — Engine V2 Mocha/Jest Suite

**Date:** April 17, 2026  
**Runner:** Jest + ts-jest  
**Target:** Engine V2 — `server/engine-v2/` (dispatch → reducer → TableState)  
**Final total: 146 tests across 9 suites | 146 passed, 0 failed ✅**

> Initial run: 83 tests, 75 passed, 8 failed. Three reducer bugs found and fixed. Three new spec files added.

---

## What We Built

### Test Harness (`server/engine-v2/tests/harness/TestHarness.ts`)

A reusable class that wraps the Engine V2 dispatch/registry system and
provides a clean API for all specs. Every test creates its own isolated
`TestHarness`, which creates a unique room in the registry — no shared
state between tests.

**Key harness methods:**

| Method | What it does |
|---|---|
| `addUser(name)` | Dispatches JOIN_SESSION, returns TestUser |
| `addUsers(n)` | Adds N users (Alice, Bob, Carol...) at once |
| `startSession(uid)` | Dispatches CLICK_READY_TO_GLOW |
| `reachConsensusOn(uid)` | All connected users point to target |
| `dropMic(socketId)` | Dispatches DROP_MIC |
| `passMic(socketId)` | Dispatches PASS_MIC |
| `disconnect(uid)` | Dispatches DISCONNECT |
| `reconnect(user)` | Dispatches RECONNECT with new socketId |
| `leave(user)` | Dispatches LEAVE_SESSION |
| `expireTimer()` | Dispatches TIMER_EXPIRED |
| `endSession()` | Dispatches END_SESSION |
| `wasEmitted(event)` | Checks if a socket event was emitted |
| `lastEmit(event)` | Gets data from the last emit of an event |
| `assertInvariants()` | Calls `assertInvariants()` on current state |
| `teardown()` | Destroys the room from registry |

**Factory helpers:**
- `createSessionWithUsers(n)` — sessionstarted, N users, ATTENTION_SELECTION
- `createSessionWithActiveSpeaker(n)` — same + consensus driven, LIVE_SPEAKER

---

## Test Suites

---

### Suite 1 — `mutationBoundary.test.ts` (pre-existing)
**Status: PASS — 6/6**

This suite was already present before Phase D testing began.
It validates the foundational architectural guarantee that effects
cannot mutate TableState, and the registry is isolated.

| Test | Result |
|---|---|
| effects cannot mutate TableState | ✅ PASS |
| dispatch mutates state through reducer | ✅ PASS |
| roomRegistry provides isolated state per room | ✅ PASS |
| invariants are checked after dispatch | ✅ PASS |
| getOrCreateRoom creates room if not exists | ✅ PASS |
| getOrCreateRoom returns existing room | ✅ PASS |

---

### Suite 2 — `session-lifecycle.spec.ts`
**Status: PASS — 17/17**

Tests the full lifecycle from room creation to session end.

#### JOIN_SESSION (5 tests)

| Test | Result |
|---|---|
| First user joins → participant added, phase stays LOBBY | ✅ PASS |
| Multiple users join → all added | ✅ PASS |
| Avatar conflict rejected when taken by CONNECTED user | ✅ PASS |
| Same user joins twice → presence updated to CONNECTED | ✅ PASS |
| Join emits `v2:user-joined` event | ✅ PASS |

#### CLICK_READY_TO_GLOW / Session Start (5 tests)

| Test | Result |
|---|---|
| Valid start → phase LOBBY → ATTENTION_SELECTION | ✅ PASS |
| Timer activated on start | ✅ PASS |
| Start emits `v2:session-started` event | ✅ PASS |
| Start from wrong phase (non-LOBBY) is ignored | ✅ PASS |
| Unknown userId cannot start session | ✅ PASS |

#### LEAVE_SESSION (2 tests)

| Test | Result |
|---|---|
| User leaves → removed from participants | ✅ PASS |
| Speaker leaves → liveSpeaker cleared, phase → ATTENTION_SELECTION | ✅ PASS |

#### TIMER_EXPIRED → END_SESSION (5 tests)

| Test | Result |
|---|---|
| Timer expires → phase becomes ENDING | ✅ PASS |
| Timer expiry emits `v2:session-ending` | ✅ PASS |
| END_SESSION → phase becomes ENDED | ✅ PASS |
| END_SESSION emits `v2:session-ended` | ✅ PASS |
| Timer expiry schedules a DELAYED_ACTION for END_SESSION after 30s | ✅ PASS |

---

### Suite 3 — `consensus-flow.spec.ts`
**Status: PASS — 11/11**

Tests the core attention/pointing mechanism and consensus detection.

#### Unanimous consensus → LIVE_SPEAKER (4 tests)

| Test | Result |
|---|---|
| 2-user room: both point to same user → LIVE_SPEAKER | ✅ PASS |
| 3-user room: all three point to same user → LIVE_SPEAKER | ✅ PASS |
| Consensus emits `live-speaker` event with correct userId | ✅ PASS |
| Speaker role becomes `speaker`, all others become `listener` | ✅ PASS |

#### Partial consensus → no phase change (2 tests)

| Test | Result |
|---|---|
| 2-user room, only one user points → no consensus | ✅ PASS |
| 3-user room, 2-of-3 point to same → no consensus (need all) | ✅ PASS |

#### Consensus broken → back to ATTENTION_SELECTION (2 tests)

| Test | Result |
|---|---|
| Re-point during LIVE_SPEAKER → phase drops, liveSpeaker cleared | ✅ PASS |
| Broken consensus emits `live-speaker-cleared` event | ✅ PASS |

#### Ghost exclusion from quorum (1 test)

| Test | Result |
|---|---|
| 3-user room: 1 ghost + 2 connected pointing same → consensus achieved (ghost excluded from quorum) | ✅ PASS |

#### Pointer map integrity (2 tests)

| Test | Result |
|---|---|
| POINT_TO_USER updates `pointerMap[fromId] → toId` | ✅ PASS |
| Re-pointing updates the existing pointer (no duplicates) | ✅ PASS |

---

### Suite 4 — `mic-flows.spec.ts`
**Status: PASS — 18/18**

Tests all mic handoff actions: DROP_MIC, PASS_MIC, ACCEPT_MIC, DECLINE_MIC,
and a full cycle test.

#### DROP_MIC (6 tests)

| Test | Result |
|---|---|
| Phase LIVE_SPEAKER → ATTENTION_SELECTION | ✅ PASS |
| `liveSpeaker` is null after drop | ✅ PASS |
| `pointerMap` is cleared after drop | ✅ PASS |
| All participant roles reset to `listener` after drop | ✅ PASS |
| Emits `live-speaker-cleared` event | ✅ PASS |
| Invariants hold after drop | ✅ PASS |

#### PASS_MIC (5 tests)

| Test | Result |
|---|---|
| Phase LIVE_SPEAKER → ATTENTION_SELECTION | ✅ PASS |
| `pointerMap` cleared after pass | ✅ PASS |
| All roles reset to `listener` after pass | ✅ PASS |
| Emits `live-speaker-cleared` | ✅ PASS |
| Invariants hold after pass | ✅ PASS |

#### ACCEPT_MIC (4 tests)

| Test | Result |
|---|---|
| User accepts mic → becomes live speaker, phase → LIVE_SPEAKER | ✅ PASS |
| Accepter's role becomes `speaker` | ✅ PASS |
| ACCEPT_MIC emits `live-speaker` event with correct userId | ✅ PASS |
| Unknown user cannot accept mic (returns 0 effects) | ✅ PASS |

#### DECLINE_MIC (3 tests)

| Test | Result |
|---|---|
| Decliner's pointer removed from pointerMap | ✅ PASS |
| Phase stays ATTENTION_SELECTION after decline | ✅ PASS |
| Decline emits REBUILD_ALL_PANELS effect | ✅ PASS |

#### Full mic cycle (1 test)

| Test | Result |
|---|---|
| Consensus → drop mic → new consensus works cleanly (2 full rounds) | ✅ PASS |

---

### Suite 5 — `disconnect-reconnect.spec.ts`
**Status: PASS — 15/15** *(was 7/15 before reducer bug fixes)*

Tests network events: disconnect, ghost preservation, reconnect,
and mid-session joins.

#### DISCONNECT (6 tests)

| Test | Result | Note |
|---|---|---|
| Disconnected user becomes GHOST, seat preserved | ✅ PASS | Multi-user room |
| Disconnected user's socketId becomes null | ✅ PASS | Fixed by reducer bug #1 |
| Speaker disconnects — others still connected — mic held | ✅ PASS | |
| Speaker disconnects — all users gone — liveSpeaker cleared | ✅ PASS | Fixed by reducer bug #1 + #2 |
| Disconnect emits `v2:user-ghosted` event | ✅ PASS | Fixed by reducer bug #1 |
| Invariants hold after disconnect | ✅ PASS | Multi-user room |

#### RECONNECT (6 tests)

| Test | Result | Note |
|---|---|---|
| Ghost user reconnects → presence becomes CONNECTED | ✅ PASS | Fixed (cascaded from disconnect bug) |
| Reconnected user gets new socketId | ✅ PASS | Fixed |
| Live speaker reconnects — mic still held | ✅ PASS | |
| Reconnect emits `v2:reconnect-state` event | ✅ PASS | Fixed |
| Reconnecting unknown user produces no changes | ✅ PASS | |
| Invariants hold after reconnect | ✅ PASS | Fixed |

#### Mid-Session Join (3 tests)

| Test | Result |
|---|---|
| User joins during ATTENTION_SELECTION — added without disrupting phase | ✅ PASS |
| User joins during LIVE_SPEAKER — phase unchanged, liveSpeaker unchanged | ✅ PASS |
| Late joiner does not break existing consensus | ✅ PASS |

---

### Suite 6 — `invariant-checks.spec.ts`
**Status: PASS — 16/16** *(was 15/16 before reducer bug fixes)*

Tests that all engine invariants are enforced: both that valid states
don't throw, and that corrupted states do.

#### Valid states — invariants never fire (7 tests)

| Test | Result | Note |
|---|---|---|
| Initial empty room passes invariants | ✅ PASS | |
| Room with joined users passes invariants | ✅ PASS | |
| Active session with live speaker passes invariants | ✅ PASS | |
| After drop mic passes invariants | ✅ PASS | |
| After disconnect passes invariants | ✅ PASS | Multi-user room |
| After reconnect passes invariants | ✅ PASS | Fixed (cascaded from disconnect bug) |
| After timer expiry passes invariants | ✅ PASS | |

#### Violation tests — corrupted state triggers InvariantViolation (5 tests)

| Test | Result |
|---|---|
| `liveSpeaker` pointing to non-existent user → InvariantViolation | ✅ PASS |
| `pointerMap` key not in participants → InvariantViolation | ✅ PASS |
| `pointerMap` value not in participants → InvariantViolation | ✅ PASS |
| phase=LIVE_SPEAKER but liveSpeaker=null → InvariantViolation | ✅ PASS |
| phase=SYNC_PAUSE but syncPause=false → InvariantViolation | ✅ PASS |

#### Regression guards (3 tests)

| Test | Result |
|---|---|
| [regression] Stale pointer after user leaves does not survive | ✅ PASS |
| [regression] liveSpeaker is cleared when speaker leaves | ✅ PASS |
| [regression] Drop mic always clears liveSpeaker (not just role reset) | ✅ PASS |

---

## Bugs Found and Fixed

Tests found **3 reducer bugs** in `server/engine-v2/reducer/reducer.ts`.
All were fixed during this session. 8 initially failing tests now pass.

---

### Bug #1 — Wrong phase on all-ghost (speaker path)

**Location:** `DISCONNECT` case — speaker branch  
**Invariant violated:** Invariant 10 — *"All users GHOST → phase must be ENDING or ENDED"*

```ts
// Before (buggy):
tableState.phase = "ATTENTION_SELECTION";

// After (fixed):
tableState.phase = "ENDING";
tableState.syncPause = false;
```

---

### Bug #2 — No all-ghost check on non-speaker disconnect

**Location:** `DISCONNECT` case — missing else branch for non-speakers  
**Invariant violated:** Invariant 10 (same)

The all-ghost check only existed inside `if (liveSpeaker === userId)`. When the
last user to disconnect was *not* the speaker, the phase was never updated,
leaving a ghost-only room in `ATTENTION_SELECTION` or `LIVE_SPEAKER`.

```ts
// After (fixed) — added else branch:
} else {
  const connectedCount = /* count CONNECTED */;
  if (connectedCount === 0) {
    if (tableState.liveSpeaker) { /* clear ghost-held speaker */ }
    tableState.phase = "ENDING";
    tableState.syncPause = false;
  }
}
```

---

### Bug #3 — TIMER_EXPIRED left liveSpeaker set

**Location:** `TIMER_EXPIRED` case  
**Invariant violated:** Invariant 14 — *"ENDING/ENDED → liveSpeaker must be null"*

The TIMER_EXPIRED handler transitioned `phase → ENDING` but never cleared an
active speaker, violating the invariant immediately.

```ts
// After (fixed) — added speaker clear:
if (tableState.liveSpeaker) {
  const speaker = tableState.participants.get(tableState.liveSpeaker);
  if (speaker) speaker.role = "listener";
  tableState.liveSpeaker = null;
}
tableState.phase = "ENDING";
```

---

## Final Summary

### Suite results

| Suite | Tests | Passed | Failed | Notes |
|---|---|---|---|---|
| mutationBoundary.test.ts | 6 | 6 | 0 | Pre-existing |
| session-lifecycle.spec.ts | 17 | 17 | 0 | |
| consensus-flow.spec.ts | 11 | 11 | 0 | |
| mic-flows.spec.ts | 18 | 18 | 0 | |
| disconnect-reconnect.spec.ts | 15 | 15 | 0 | Was 7/15 — fixed by bugs #1 + #2 |
| invariant-checks.spec.ts | 16 | 16 | 0 | Was 15/16 — fixed by bugs #1 + #2 |
| sync-pause.spec.ts | 13 | 13 | 0 | New |
| timer-scenarios.spec.ts | 24 | 24 | 0 | New — found bug #3 |
| multi-room-smoke.spec.ts | 26 | 26 | 0 | New |
| **Total** | **146** | **146** | **0** | ✅ All passing |

---

### What all 146 tests confirm

**Session lifecycle**
- JOIN_SESSION, multi-join, avatar conflict protection, duplicate join (reconnect path)
- Session start gating (phase check, userId check, timer activation)
- LEAVE_SESSION: participant removal, speaker-leave cleanup
- Full timer expiry chain: ENDING → DELAYED_ACTION(30s) → ENDED → SCHEDULE_CLEANUP
- ADMIN_END_SESSION: immediate ENDED, no grace period, correct `reason` field
- Timer selectors: `isTimerExpired`, `getRemainingTime`, `isInGracePeriod`

**Consensus**
- Unanimous consensus in 2-user and 3-user rooms
- Partial consensus correctly rejected
- Consensus broken by re-pointing → drops to plain ATTENTION_SELECTION
- Ghost users excluded from quorum count
- Pointer map updates correctly, no duplicates

**Mic flows**
- DROP_MIC: phase, liveSpeaker, pointerMap cleared, all roles reset, events emitted
- PASS_MIC: identical mutations to DROP_MIC
- ACCEPT_MIC: instant speaker promotion, syncPause cleared
- DECLINE_MIC: pointer cleanup only, phase unchanged
- Full multi-round mic cycle (drop → new consensus)

**Sync pause semantics**
- `syncPause` stays `false` on normal flows and broken consensus
- `syncPause` set `true` only by explicit DROP_MIC / PASS_MIC
- ACCEPT_MIC always clears `syncPause`
- LIVE_SPEAKER and `syncPause=true` never co-exist
- All disconnect/all-ghost paths leave `syncPause=false`

**Disconnect / reconnect**
- Disconnect → GHOST, seat preserved, socketId null
- Speaker disconnects with others online → mic preserved
- Speaker disconnects, all gone → ENDING, liveSpeaker cleared
- Non-speaker last to disconnect → ENDING, ghost-held speaker cleared
- Reconnect → CONNECTED, new socketId, events emitted
- Live speaker reconnect → mic preserved
- Mid-session join (ATTENTION_SELECTION and LIVE_SPEAKER) doesn't disrupt state

**Invariants**
- All 14 invariants verified via valid-state and corruption tests
- stale pointer, liveSpeaker not cleared, role-only reset — all regression guarded

**Multi-room isolation**
- Phase, participants, pointerMap fully isolated per room
- Effects carry correct `roomId` — no cross-room emission
- 3 rooms concurrent: independent speakers, independent expiry
- Registry: count, hasRoom, createRoom collision, getOrCreateRoom identity, clearAll

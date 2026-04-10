# Phase D: V2 Full Ownership Plan

**Goal:** V2 becomes the single source of truth for session state. V1's `evaluateSync()`, legacy globals (`pointerMap`, `liveSpeaker`, `isSyncPauseMode`), and per-handler panel rebuilds are all removed. V2 owns the full flow end-to-end.

**Prerequisite:** Phase C complete ✅ (POINT_TO_USER, EVALUATE_SYNC, shadow dispatch, SpeakerManager wired)

---

## Step 1 — Wire `REBUILD_ALL_PANELS` effect to actually emit panels

**Files:** `server/engine-v2/effects/runEffects.ts`, `server/socketHandler.ts`

**What:** The `REBUILD_ALL_PANELS` effect is already produced by V2 on every consensus event but currently just logs. It needs to actually call `getPanelConfigFor()` for every connected user and emit `receive:panelConfig`.

**How:**
- In `runEffects.ts`, `REBUILD_ALL_PANELS` case: iterate `roomRegistry.getRoom(roomId).participants`, find each user's socketId, call `getPanelConfigFor(displayName)` and `io.to(socketId).emit("receive:panelConfig", config)`
- This replaces the panel loop in V1's `evaluateSync()`

**Test:** After consensus fires, check `[PANEL-SNAPSHOT][V2]` appears and panels render. If `[PANEL-SNAPSHOT][V1-SYNC]` also fires right after, V1 is still running in parallel — that's OK for now (no-harm shadow).

---

## Step 2 — Implement `DROP_MIC` in V2 reducer

**Files:** `server/engine-v2/reducer/reducer.ts`, `server/engine-v2/shadow/actionMapper.ts`

**What:** When speaker drops the mic, V2 should:
- Clear `liveSpeaker`
- Clear all pointers in `pointerMap`
- Set `syncPause = true`
- Transition phase to `ATTENTION_SELECTION` (or a new `MIC_DROPPED` sub-phase if needed)
- Emit `REBUILD_ALL_PANELS` effect

**V1 equivalent:** `handleDropTheMic.ts` — clears all pointers, sets `isSyncPauseMode = true`, rebuilds panels

**actionMapper:** `DROP_MIC` already passes through with `{}` payload — just needs the reducer case filled in.

---

## Step 3 — Implement `PASS_MIC` in V2 reducer

**Files:** `server/engine-v2/reducer/reducer.ts`

**What:** When speaker passes the mic:
- Clear `liveSpeaker`
- Clear all pointers
- Set `syncPause = true`
- Transition to `ATTENTION_SELECTION`
- Emit `REBUILD_ALL_PANELS`

**V1 equivalent:** `handlePassTheMic.ts` — same as DROP_MIC but with `isPassingTheMic` user state

**Note:** V2 doesn't track per-user UI states (`isPassingTheMic`, `micPassInProcess`) — those stay in V1 user map for now. V2 only needs to track the structural state (phase, pointerMap, liveSpeaker, syncPause).

---

## Step 4 — Implement `ACCEPT_MIC` / `DECLINE_MIC` in V2 reducer

**Files:** `server/engine-v2/reducer/reducer.ts`

**What:**
- `ACCEPT_MIC`: User accepts the passed mic → set candidate as `liveSpeaker`, transition to `LIVE_SPEAKER`, `syncPause = false`, emit `REBUILD_ALL_PANELS`
- `DECLINE_MIC`: User declines → clear candidate, stay in `ATTENTION_SELECTION`, emit `REBUILD_ALL_PANELS`

**V1 equivalents:** `handleAcceptMicOfferFromPassTheMic.ts`, `handleDeclineToSpeakAfterMicDropped.ts`

---

## Step 5 — Implement `LEAVE_SESSION` and `RECONNECT` in V2 reducer

**Files:** `server/engine-v2/reducer/reducer.ts`

**`LEAVE_SESSION`:**
- Remove participant from `tableState.participants` entirely (vs GHOST which keeps the seat)
- If they were `liveSpeaker`, clear speaker + reset phase
- Emit `REBUILD_ALL_PANELS`

**`RECONNECT`:**
- Find participant by userId, restore `presence = "CONNECTED"`, update `socketId`
- Emit `EMIT_FULL_STATE_TO_USER` to hydrate their client

**Note:** `EMIT_FULL_STATE_TO_USER` effect needs wiring in `runEffects.ts` alongside this step — send current `live-speaker`, `update-pointing`, and panel config to the reconnected socket.

---

## Step 6 — Wire `SOCKET_EMIT_USER` effect in runEffects

**Files:** `server/engine-v2/effects/runEffects.ts`

**What:** Many V2 actions need to target a single user (reconnect hydration, panel config on join). Currently a no-op stub. Wire it up:
- Look up socketId from `tableState.participants.get(effect.userId).socketId`
- `io.to(socketId).emit(effect.event, effect.data)`

---

## Step 7 — Remove V1's `evaluateSync()` from socketHandler

**Files:** `server/socketHandler.ts`, `server/actions/handlers/*.ts`

**Prerequisite:** Steps 1–4 must be complete and tested in shadow mode.

**What:** Once V2 owns `DROP_MIC` / `PASS_MIC` / `ACCEPT_MIC` and `REBUILD_ALL_PANELS` actually emits panels, V1's `evaluateSync()` is a duplicate. Remove:
- The `evaluateSync()` function from `socketHandler.ts`
- All `evaluateSync()` calls from action handlers
- The legacy globals: `pointerMap` (Map), `liveSpeaker` (let), `isSyncPauseMode` (let)
- The legacy branches in `getPointerMap()`, `getLiveSpeaker()`, `getIsSyncPauseMode()`, `setPointer()`, `clearPointer()` etc. (remove the `else` fallback)

**Result:** `panelConfigService.ts` will pull state entirely from `SpeakerManager` / `TableState`.

---

## Step 8 — Wire `GLIFF_APPEND` effect (low priority)

**Files:** `server/engine-v2/effects/runEffects.ts`, `server/gliffLogService.ts`

**What:** V2's `TEXT_INPUT` and `SEND_GESTURE` should eventually append to the gliff log. For now V1 still owns this. Wire when gestures/text are migrated.

---

## Step 9 — Implement `SEND_GESTURE` and `TEXT_INPUT` (low priority)

**Files:** `server/engine-v2/reducer/reducer.ts`, `server/engine-v2/shadow/actionMapper.ts`

**What:** Track gestures and text messages in V2 `TableState` (for FireKeeper observation and future replay). V1 still owns the gliff log and UI state updates for now.

---

## Phase D Completion Criteria

| Criterion | Check |
|---|---|
| `REBUILD_ALL_PANELS` emits panels to all connected sockets | ✅ when done |
| `DROP_MIC`, `PASS_MIC`, `ACCEPT_MIC`, `DECLINE_MIC` implemented in reducer | ✅ when done |
| `[PANEL-SNAPSHOT][V1-SYNC]` log disappears (evaluateSync removed) | ✅ when done |
| `[PANEL-SNAPSHOT][V1]` still fires per-user from `panelConfigService` (ok — V1 UI states still drive panel type) | ✅ by design |
| Legacy globals removed from `socketHandler.ts` | ✅ when done |
| `RECONNECT` / `LEAVE_SESSION` implemented | ✅ when done |
| No `not yet implemented` warnings in production logs | ✅ when done |

---

## What Stays in V1 After Phase D

- Per-user UI state (`user.state`: `speaking`, `isPassingTheMic`, `micIsDropped`, etc.) — these are panel-render states, not session-structural states. They stay in the V1 `users` Map until a potential Phase E that models them in V2's `ParticipantState`.
- `panelConfigService.ts` and `panelBuilderRouter.ts` — panel building logic stays as-is. V2 just triggers the rebuild.
- Gliff log writing (`gliffLogService.ts`)

---

## Phase E (Future — out of scope for now)

- Model per-user UI states in V2 `ParticipantState` (replacing V1 `users` Map entirely)
- FireKeeper joins as socket client with `firekeeper` role
- V2 becomes authoritative for panel config generation (replace `panelBuilderRouter` with V2-native builders)
- Full removal of V1 action handlers

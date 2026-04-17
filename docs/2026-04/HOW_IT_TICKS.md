# SoulCircle — How It Ticks

A complete orientation to the panel system, action system, user states, and gliff log.
Read this before implementing any new feature.

---

## 1. The Big Picture

SoulCircle is a real-time group conversation tool. Every participant sees a **panel** —
a small interactive UI of buttons and text — that changes based on what is happening in
the room. The server owns all state. The client only renders what the server tells it to.

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENT                                                          │
│                                                                  │
│  User clicks button                                              │
│    → SmartButtonRenderer.tsx                                     │
│        socket.emit("clientEmits", { name, type, actionType, … }) │
└──────────────────────────────────┬───────────────────────────────┘
                                   │  WebSocket
┌──────────────────────────────────▼───────────────────────────────┐
│  SERVER                                                          │
│                                                                  │
│  socketHandler.ts  (receives "clientEmits")                      │
│    → validates type is allowed ("ear","brain","mouth","mic","blue")│
│    → routeAction()                                               │
│        → finds matching entry in actionConfig.ts                 │
│        → calls handler from handlersMap.ts                       │
│            → handler mutates UserState in users Map              │
│            → handler calls getPanelConfigFor(userName)           │
│                → panelConfigService.ts → panelBuilderRouter.ts   │
│                    → listenersPanelBuilder / speakerPanelBuilder  │
│                        → listenerCatalog → listenerConfigs       │
│                            io.to(socketId).emit("receive:panelConfig") │
└──────────────────────────────────────────────────────────────────┘
                                   │  WebSocket
┌──────────────────────────────────▼───────────────────────────────┐
│  CLIENT                                                          │
│                                                                  │
│  usePanelLayoutConfig.ts receives "receive:panelConfig"          │
│    → setPanelConfig(payload)                                     │
│    → SoulCirclePanelRobust renders new panel                     │
│        → RenderBlock.tsx → SmartButtonRenderer.tsx               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. UserState — The Heart of Everything

Every participant has exactly one `UserState` at all times. It is a plain string stored in
the `users` Map on the server (`Map<socketId, UserInfo>`).

**The panel a user sees is entirely determined by their UserState.**

```typescript
// panelConfigService.ts
type UserState =
  | "regular"               // default — no group open
  | "speaking"              // this user is the live speaker
  | "hasClickedEar"         // Ear group expanded
  | "hasClickedBrain"       // Brain group expanded
  | "hasClickedMouth"       // Mouth group expanded
  | "waiting"               // passive wait (another listener acted)
  | "micIsDropped"          // mic was dropped, choosing whether to pick up
  | "wantsToPickUpTheMic"   // raised hand to pick up dropped mic
  | "isPickingBlueSpeaker"  // brain-blue: choosing who to offer mic to (state-18)
  | "isPickingEarBluePerson"// ear-blue: choosing who to hear more from (state-19)
  // … and more
```

**Rule:** If you need a user to see a different screen, create a new state for it.
The state name is the single source of truth that connects the action, the handler,
the builder, and the panel config.

---

## 3. The Action System

### 3a. How a button press reaches the server

Every button in the UI emits `clientEmits` via socket:

```typescript
socket.emit("clientEmits", {
  name: me,          // who is clicking
  type: "blue",      // family: "ear" | "brain" | "mouth" | "mic" | "blue"
  actionType: "earBlueSelectStart",  // the specific action
  targetUser: "...", // optional: relevant person
  flavor: "...",     // optional: variant hint
});
```

The `type` field is a **gate**. The server rejects any `type` not in the allowed list.
It is not the same as the button's panel `group` — it is the routing family.

### 3b. actionConfig.ts — the routing table

```typescript
// circle-server/server/actions/actionConfig.ts
{
  actionType: "earBlueSelectStart",
  type: "blue",
  handler: "handleEarBlueSelectStart",
}
```

`routeAction()` finds the entry where both `actionType` AND `type` match the payload,
then calls the named handler from `handlersMap`.

### 3c. handlersMap.ts — the handler registry

```typescript
import { handleEarBlueSelectStart } from "./handlers/handleEarBlueSelectStart";

export const handlersMap = {
  handleEarBlueSelectStart,
  // …all handlers
};
```

Every handler must be imported here or it will never be called.

### 3d. The handler

A handler receives `(payload, context)` and is responsible for:
1. Validating the payload
2. Mutating `user.state` in the `users` Map for the right user(s)
3. Calling `getPanelConfigFor(userName)` to compute the new panel
4. Emitting `receive:panelConfig` to the affected socket(s)
5. Optionally: writing to the gliff log, updating pointerMap, toggling sync pause mode

```typescript
// Emit to ONE user only:
io.to(socketId).emit("receive:panelConfig", config);

// Emit to ALL users:
for (const [socketId, user] of users.entries()) {
  io.to(socketId).emit("receive:panelConfig", getPanelConfigFor(user.name));
}
```

---

## 4. The Panel System

### 4a. panelBuilderRouter — the top-level branch

```typescript
// panelBuilderRouter.ts
if (liveSpeaker || isSyncPauseMode) {
  isUserSpeaker ? buildSpeakerPanel(ctx) : buildListenerSyncPanel(ctx)
} else {
  buildAttentionPanel(ctx)
}
```

There are three panel families:
- **Attention panel** — pre-session or between speakers (pointing, attention selection)
- **Speaker panel** — shown only to the current speaker
- **Listener sync panel** — shown to all listeners during a live session

### 4b. listenersPanelBuilder — where states map to panels

```typescript
// listenersPanelBuilder.ts
switch (currentUser?.state) {
  case "hasClickedEar":         stateKey = "state-2";  break;
  case "isPickingEarBluePerson": stateKey = "state-19"; break;
  // …
}
```

The `stateKey` selects an entry from `listenerCatalog`, which holds the static panel config.
After loading the config, **dynamic injection blocks** enrich it with runtime data:

```typescript
if (stateKey === "state-19") {
  // Build one button per participant and inject into the panel section
  const candidates = Array.from(ctx.allUsers.values())
    .filter(u => u.name !== ctx.userName)
    .map(user => ({ … button: { actionType: "earBluePersonChosen", targetUser: user.name } }));

  config.forEach(block => {
    if (block.id === "ear-blue-choose-button-panel") block.blocks = candidates;
  });
}
```

### 4c. listenerCatalog — the panel registry

```typescript
// listenerCatalog.ts
"state-19": new ListenerPanelState(
  "state-19",
  "Ear-blue picker — choose who to hear more from",
  panelEarBluePicker
)
```

Each entry wraps a static `PanelConfig` array. The builder calls `.getConfig()` which
returns a **deep clone** so mutations (dynamic injection) don't corrupt the original.

### 4d. listenerConfigs.ts — the static panel shapes

```typescript
// listenerConfigs.ts
export const panelEarBluePicker: PanelConfig = [
  {
    id: "ear-blue-choose-header",
    layout: "column",
    blocks: [{ id: "ear-blue-instruction-text", type: "text", content: "Who would you like to hear more from?" }],
  },
  {
    id: "ear-blue-choose-button-panel",
    layout: "row",
    blocks: [],  // ← left empty; filled by dynamic injection in the builder
  },
];
```

**Rule:** Give every section a unique `id`. The builder finds sections by `id` for injection.
Leave `blocks: []` for any section that will be filled dynamically at runtime.

---

## 5. Block Types and SmartButtonRenderer

### 5a. blockTypes.ts — the panel data model

A panel is an array of `PanelSection`, each containing `PanelBlock[]`.
A block is one of: `text`, `emoji`, `spacer`, `button`.

Button blocks have a nested `button` object:

```typescript
button: {
  label: "Who to hear from?",
  type: "listenerControl",    // routes to the correct switch case in SmartButtonRenderer
  group: "blue",              // passed to server as payload.type
  actionType: "earBluePersonChosen",
  targetUser: "...",          // optional
  flavor: "...",              // optional — for logs/analytics
}
```

**`button.type` controls which switch case fires in SmartButtonRenderer.**
If you add a new `type`, you must add it to the union in `blockTypes.ts` AND handle it
in `SmartButtonRenderer.tsx`.

### 5b. SmartButtonRenderer.tsx — the client router

```typescript
case "listenerControl":
  switch (config.actionType) {
    case "earBluePersonChosen":
      socket.emit("clientEmits", {
        name: me,
        type: "blue",
        actionType: "earBluePersonChosen",
        targetUser: config.targetUser,
      });
      break;
  }
```

Every `actionType` that can be emitted from a `listenerControl` button needs its own
`case` here. Missing cases fall through to `console.warn` and do nothing.

---

## 6. The Gliff Log

The gliff log is the live conversation feed displayed in the UI (the floating message
bubbles on the table). Any handler can write to it.

```typescript
import { createGliffLog } from "../../gliffLogService";

createGliffLog(
  {
    userName: name,
    message: {
      messageType: "gesture",   // "gesture" | "action" | "textInput" | "context"
      content: "I'd love to hear from 'Amit'",
      emoji: "🙋",
      timestamp: Date.now(),
    },
  },
  io,
);
```

`messageType` determines display style on the client. `"gesture"` is the standard for
listener button presses. `"textInput"` supports character-by-character streaming and
merges consecutive characters from the same user.

The log stores the last 20 entries in memory and broadcasts the current snapshot on
every write via `io.emit("gliff-log-update", gliffMemory)`.

---

## 7. The Gesture Catalog

The gesture catalog (`gestureCatalog.ts`) is the authoritative list of all named gestures
and their properties. It is used by two things:

1. **`gesture.service.ts`** — `getAllGestureButtons()` reads it to build dynamic
   sub-gesture buttons for state-2/state-3/state-4 ear/brain/mouth panels.
2. **`handleSyncedGesture.ts`** — looks up a gesture by `subType` code to call
   `triggerEffect()` and log to the gliff.

```typescript
"004": new Gesture(
  "004",          // code (subType)
  "I'd love to hear…",  // label
  "🙋",           // emoji
  "blue",         // color
  "px-4 …",       // tailwind classes
  "earBlueSelectStart",  // actionType
  "loveToHear"    // flavor (optional)
)
```

**Important:** If `actionType` is `"syncedGesture"` the builder injects the gesture as a
`semiListenerAction` button (synced, logs to gliff via `handleSyncedGesture`).
If `actionType` is anything else (e.g. `"earBlueSelectStart"`), the builder **skips it**
during dynamic injection — the static config in `listenerConfigs.ts` already defines that
button with its own `listenerControl` type. The catalog entry is used only for its
metadata (label, emoji, tailwind) and for `triggerEffect`.

---

## 8. Sync Pause Mode

`isSyncPauseMode` is a global flag in `socketHandler.ts`. When `true`, the router sends
listeners to `buildListenerSyncPanel` even when there is no `liveSpeaker`.

It is set to `true` by handlers that want to lock the group into a shared interactive
state (e.g. `handleBlueSelectStart`, `handlePassTheMic`).

**Ear-blue does NOT use sync pause** — it is a private, personal action. Only the
initiating listener changes state. Nobody else is affected.

---

## 9. Quick Reference — Files and Their Roles

| File | Role |
|---|---|
| `socketHandler.ts` | Receives all socket events, validates `type`, calls `routeAction` |
| `actions/routeAction.ts` | Matches `{actionType, type}` → handler name |
| `actions/actionConfig.ts` | Routing table: actionType + type → handler name string |
| `actions/handlersMap.ts` | Registry: handler name string → function |
| `actions/handlers/*.ts` | One file per action. Mutates state, emits panel |
| `panelConfigService.ts` | Builds `PanelContext`, calls `panelBuilderRouter` |
| `panelBuilderRouter.ts` | Top-level branch: attention / speaker / listener |
| `listenersPanel/listenersPanelBuilder.ts` | Maps UserState → stateKey, loads + enriches config |
| `ui-config/listenerCatalog.ts` | Registry: stateKey → ListenerPanelState |
| `ui-config/listenerConfigs.ts` | Static panel shape definitions |
| `ui-config/gestureCatalog.ts` | Master list of all named gestures |
| `ui-config/gesture.service.ts` | `getAllGestureButtons()` — reads catalog for builders |
| `gliffLogService.ts` | In-memory log, merges text, broadcasts on write |
| `Circle/src/components/SoulCirclePanel/blockTypes.ts` | TypeScript types for the panel data model |
| `Circle/src/components/SoulCirclePanel/SmartButtonRenderer.tsx` | Client socket.emit router per button type |
| `Circle/src/components/SoulCirclePanel/RenderBlock.tsx` | Renders a single block (text/button/emoji/spacer) |
| `Circle/src/components/SoulCirclePanel/usePanelLayoutConfig.ts` | Listens for `receive:panelConfig`, drives re-render |

---

## 10. The Minimal Change Set for a New Feature

```
Server:
  1. panelConfigService.ts      — add UserState string
  2. routeAction.ts             — add same UserState string (mirrored copy)
  3. ui-config/listenerConfigs.ts — add PanelConfig object
  4. ui-config/listenerCatalog.ts — register it under a new state key
  5. listenersPanel/listenersPanelBuilder.ts — add case in switch + inject block if needed
  6. actions/handlers/handleMyAction.ts — new file: mutate state, emit panel, log gliff
  7. actions/actionConfig.ts    — add { actionType, type, handler } entry
  8. actions/handlersMap.ts     — import + register handler

Client:
  9. SmartButtonRenderer.tsx    — add case for the new actionType
  10. blockTypes.ts             — extend type/group unions only if new values needed
```

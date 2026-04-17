# Feature Implementation Guide — SoulCircle

This guide explains the end-to-end pattern for adding a new interactive feature (button press → state change → panel update) to the SoulCircle app.

---

## Architecture Overview

```
Client button click
  → SmartButtonRenderer.tsx  (socket.emit)
    → server: routeAction.ts  (matches actionType → handler)
      → handler file          (updates user state, emits panel)
        → panelConfigService.ts → panelBuilderRouter.ts
          → listenersPanelBuilder.ts / speakerPanelBuilder.ts
            → listenerCatalog.ts → listenerConfigs.ts
              → receive:panelConfig (client re-renders)
```

The key data unit is `UserState`. Every feature is driven by moving a user into a new state, then having the panel builder detect that state and serve the matching panel config.

---

## Step-by-Step: Adding a New Feature

### 1. Define the User State

Every distinct screen a user can see needs a corresponding state string.

**Files to update:**

`circle-server/server/panelConfigService.ts` — add to the `UserState` type union:
```ts
type UserState =
  | "regular"
  | "speaking"
  | "myNewState"       // ← add here
  // ...
```

`circle-server/server/actions/routeAction.ts` — mirror the same state in its local `UserState` type:
```ts
type UserState =
  | "regular"
  | "speaking"
  | "myNewState"       // ← add here
  // ...
```

---

### 2. Create the Panel Config

A panel config is an array of `PanelSection` objects, each with a layout, panelType, and blocks (text, buttons, etc.).

**File:** `circle-server/server/ui-config/listenerConfigs.ts`

```ts
export const myNewStatePanel: PanelConfig = [
  {
    id: "my-panel-header",
    layout: "column",
    panelType: "listenerSyncPanel",
    label: "My Feature",
    blocks: [
      {
        id: "my-text",
        type: "text",
        content: "What would you like to do?",
        size: "md",
        align: "center",
        textClass: "text-center text-gray-700 font-semibold",
      },
    ],
  },
  {
    id: "my-button-panel",
    layout: "row",
    panelType: "listenerSyncPanel",
    label: "Choices",
    blocks: [
      {
        id: "my-action-btn",
        type: "button",
        buttonClass: "px-5 py-3 rounded-full text-sm font-semibold ...",
        button: {
          label: "Do the thing",
          type: "listenerControl",   // ← see button types below
          group: "blue",
          actionType: "myActionChosen",
          targetUser: "PLACEHOLDER", // injected dynamically if needed
        },
      },
    ],
  },
];
```

**Button `type` values:**
| type | When to use |
|---|---|
| `gesture` | Opens/closes an ear/brain/mouth group |
| `semiListenerAction` | Passive listener signal (no route change) |
| `listenerControl` | Listener takes a meaningful action (routing change) |
| `speakerControl` | Speaker-only actions (pass mic, drop mic, etc.) |
| `attentionTarget` | Pointing at someone |

---

### 3. Register the Panel in the Catalog

**File:** `circle-server/server/ui-config/listenerCatalog.ts`

```ts
import { myNewStatePanel } from "./listenerConfigs";

export const listenerCatalog = {
  // ...existing entries...
  "state-19": new ListenerPanelState(
    "state-19",
    "My new feature description",
    myNewStatePanel
  ),
};
```

Use the next available state number.

---

### 4. Route the State in the Panel Builder

**File:** `circle-server/server/listenersPanel/listenersPanelBuilder.ts`

In the `switch (currentUser?.state)` block:
```ts
case "myNewState":
  stateKey = "state-19";
  break;
```

If the panel needs dynamic content (e.g., participant name buttons), add an injection block after the switch:
```ts
if (stateKey === "state-19") {
  // Build dynamic blocks and inject into a panel section by its id
  const dynamicBlocks: PanelBlock[] = Array.from(ctx.allUsers.values())
    .filter((u) => u.name !== ctx.userName)
    .map((u) => ({
      id: `pick-${u.name}`,
      type: "button",
      buttonClass: "...",
      button: {
        label: u.name,
        type: "listenerControl",
        group: "blue",
        actionType: "myActionChosen",
        targetUser: u.name,
      },
    }));

  config.forEach((block) => {
    if (block.id === "my-button-panel") {
      block.blocks = dynamicBlocks;
    }
  });
}
```

---

### 5. Create the Server Handler

**File:** `circle-server/server/actions/handlers/handleMyAction.ts`

```ts
import { ActionContext, ActionPayload } from "../routeAction";
import { getPanelConfigFor } from "../../panelConfigService";

export function handleMyAction(
  payload: ActionPayload,
  context: ActionContext,
) {
  const { name, targetUser } = payload;
  const { users, io, logAction, logSystem } = context;

  if (!name) {
    logSystem("handleMyAction: missing name");
    return;
  }

  // Update state for the relevant user(s)
  for (const [socketId, user] of users.entries()) {
    if (user.name === name) {
      user.state = "myNewState";
      users.set(socketId, user);

      // Re-emit panel to this user
      const config = getPanelConfigFor(user.name);
      io.to(socketId).emit("receive:panelConfig", config);
      return;
    }
  }

  logSystem(`handleMyAction: user "${name}" not found`);
}
```

**Key patterns:**
- Change one user's state → emit only to that socket: `io.to(socketId).emit(...)`
- Change all users' states → iterate all and emit to each
- For sync-pause behavior (all users blocked): call `setIsSyncPauseMode(true)` from `socketHandler`

---

### 6. Register the Handler

**`circle-server/server/actions/actionConfig.ts`** — add an entry:
```ts
{
  actionType: "myAction",
  type: "blue",         // or "mic", "ear", "mouth", "brain" — used for matching
  handler: "handleMyAction",
},
```

**`circle-server/server/actions/handlersMap.ts`** — import and register:
```ts
import { handleMyAction } from "./handlers/handleMyAction";

export const handlersMap = {
  // ...existing...
  handleMyAction,
};
```

---

### 7. Wire the Client Button

**File:** `Circle/src/components/SoulCirclePanel/SmartButtonRenderer.tsx`

Inside the `case "listenerControl":` switch on `config.actionType`:
```ts
case "myActionChosen":
  socket.emit("clientEmits", {
    name: me,
    type: config.group,       // "blue"
    actionType: "myActionChosen",
    targetUser: config.targetUser,  // if picking a person
  });
  break;
```

If `actionType` is something that doesn't yet exist in the switch, add a case. Each case emits `clientEmits` with the fields the server handler reads from `payload`.

---

### 8. If Frontend Type Definitions Need Updating

**File:** `Circle/src/components/SoulCirclePanel/blockTypes.ts`

If your button uses a `type`, `group`, or field not yet in the `ButtonBlock` union — add it:
```ts
type: "gesture" | "attentionTarget" | "speakerControl" | "listenerAction" | "semiListenerAction" | "listenerControl" | "myNewType";
group?: "ear" | "brain" | "mouth" | "blue" | "myNewGroup";
myNewField?: string;
```

---

## Real Example: blueSelectStart → bluePersonChosen (2026-04-17)

This flow was implemented as a reference:

| Step | What | File |
|---|---|---|
| State | `isPickingBlueSpeaker` | `panelConfigService.ts`, `routeAction.ts` |
| Panel config | `testPanelListenerState18` — header + empty blocks | `listenerConfigs.ts` |
| Catalog | `state-18` → `testPanelListenerState18` | `listenerCatalog.ts` |
| Builder routing | `case "isPickingBlueSpeaker": stateKey = "state-18"` | `listenersPanelBuilder.ts` |
| Dynamic injection | `if (stateKey === "state-18")` → inject participant buttons | `listenersPanelBuilder.ts` |
| Start handler | `handleBlueSelectStart` — sets state, emits only to picker | `handlers/handleBlueSelectStart.ts` |
| Pick handler | `handleBluePersonChosen` — resets to `regular`, emits panel | `handlers/handleBluePersonChosen.ts` |
| Action config | `blueSelectStart` + `bluePersonChosen` entries | `actionConfig.ts` |
| Handlers map | Both handlers imported and registered | `handlersMap.ts` |
| Client emit | `case "blueSelectStart"` + `case "bluePersonChosen"` | `SmartButtonRenderer.tsx` |

---

## Checklist

```
[ ] 1. New UserState string in panelConfigService.ts + routeAction.ts
[ ] 2. Panel config object in listenerConfigs.ts
[ ] 3. Entry in listenerCatalog.ts
[ ] 4. case in listenersPanelBuilder.ts switch
[ ] 5. Dynamic injection block in listenersPanelBuilder.ts (if needed)
[ ] 6. Handler file in server/actions/handlers/
[ ] 7. Entry in actionConfig.ts
[ ] 8. Import + entry in handlersMap.ts
[ ] 9. case in SmartButtonRenderer.tsx listenerControl switch
[ ] 10. Type union update in Circle/src/components/SoulCirclePanel/blockTypes.ts (if needed)
```

# SoulCircle — Developer Guide
## How to Implement a Feature Without Breaking the State Machine

---

## 0. Core Mental Model (Do Not Skip)

Before writing any code, lock this in:

> SoulCircle is NOT a UI app. It is a **state machine with a UI projection**.

- Users do NOT "navigate screens"
- Users transition between **states**
- The UI (panel) is just a **render of state**

If you break this rule, things WILL desync.

---

## 1. The Golden Rule

> ❗ Never change UI directly. Always change **UserState**.

Wrong:
- "I want to show a new button"

Correct:
- "I need a new state where this button exists"

---

## 2. The Feature Flow (End-to-End)

Every feature MUST follow this exact chain:

```
Button → clientEmits → routeAction → handler → state change → panel rebuild → UI render
```

If you skip any link, the feature will silently fail.

---

## 3. Step-by-Step Implementation Checklist

### Step 1 — Define the Intent Clearly

Ask yourself:

- Who triggers it?
- Who is affected?
- Is it private or global?
- Does it interrupt flow or not?

This determines:
- whether you use sync pause
- whether you emit to one user or all

---

### Step 2 — Create / Reuse a State

Add a new state ONLY if needed:

```ts
"isDoingSomething"
```

Rules:
- State name = behavior description
- Keep names explicit (avoid vague names like "active")

Then add it in:
- `panelConfigService.ts`
- `routeAction.ts` (mirror!)

---

### Step 3 — Create Panel Config

In `listenerConfigs.ts`:

```ts
export const panelMyFeature: PanelConfig = [
  {
    id: "my-feature-header",
    layout: "column",
    blocks: [
      { type: "text", content: "Do something" }
    ]
  },
  {
    id: "my-feature-buttons",
    layout: "row",
    blocks: [] // dynamic
  }
];
```

Rules:
- ALWAYS give sections unique IDs
- Leave `blocks: []` if injecting dynamically

---

### Step 4 — Register in Catalog

`listenerCatalog.ts`

```ts
"state-XX": new ListenerPanelState(
  "state-XX",
  "My feature description",
  panelMyFeature
)
```

---

### Step 5 — Map State → StateKey

`listenersPanelBuilder.ts`

```ts
case "isDoingSomething":
  stateKey = "state-XX";
  break;
```

---

### Step 6 — Dynamic Injection (If Needed)

Inside builder:

```ts
if (stateKey === "state-XX") {
  const buttons = users.map(u => ({
    type: "button",
    button: {
      label: u.name,
      type: "listenerControl",
      group: "blue",
      actionType: "myFeatureSelect",
      targetUser: u.name
    }
  }));

  config.forEach(block => {
    if (block.id === "my-feature-buttons") {
      block.blocks = buttons;
    }
  });
}
```

---

### Step 7 — Create Handler

`actions/handlers/handleMyFeature.ts`

```ts
export function handleMyFeature(payload, ctx) {
  const user = ctx.users.get(ctx.socketId);

  // 1. validate
  if (!payload.targetUser) return;

  // 2. mutate state
  user.state = "isDoingSomething";

  // 3. emit panel
  ctx.io.to(ctx.socketId).emit(
    "receive:panelConfig",
    getPanelConfigFor(user.name)
  );
}
```

---

### Step 8 — Register Action

`actionConfig.ts`

```ts
{
  actionType: "myFeatureSelect",
  type: "blue",
  handler: "handleMyFeature"
}
```

---

### Step 9 — Register Handler

`handlersMap.ts`

```ts
import { handleMyFeature } from "./handlers/handleMyFeature";

handleMyFeature
```

---

### Step 10 — Client Emit (CRITICAL)

`SmartButtonRenderer.tsx`

```ts
case "myFeatureSelect":
  socket.emit("clientEmits", {
    name: me,
    type: "blue",
    actionType: "myFeatureSelect",
    targetUser: config.targetUser
  });
  break;
```

❗ Missing this step = button does nothing.

---

## 4. Common Failure Modes (You WILL Hit These)

### ❌ 1. Button renders but nothing happens

Cause:
- missing case in SmartButtonRenderer

---

### ❌ 2. Handler never runs

Cause:
- missing in `actionConfig.ts`
- OR wrong `type`

---

### ❌ 3. Panel does not change

Cause:
- state not updated
- OR state not mapped in builder

---

### ❌ 4. UI updates wrong users

Cause:
- emitted to all instead of one
- OR vice versa

---

### ❌ 5. Panel config corrupted

Cause:
- mutating shared config instead of cloned config

---

## 5. Design Decisions Checklist

Before coding, answer:

- Is this action:
  - private? → emit to one
  - global? → emit to all

- Does it:
  - interrupt flow? → use sync pause
  - stay personal? → no sync pause

- Does it:
  - need user selection? → dynamic injection
  - static? → config only

---

## 6. Naming Conventions (Keep the System Readable)

| Thing | Rule |
|------|------|
| state | `isDoingX`, `hasClickedX`, `waitingForX` |
| actionType | verb-based: `selectUser`, `startSomething` |
| handler | `handleX` |
| panel id | kebab-case |
| stateKey | `state-XX` |

---

## 7. Advanced Rule — Scope of Impact

Every feature must define its **blast radius**:

| Type | Behavior |
|------|----------|
| Personal | Only one user state changes |
| Shared | Multiple users updated |
| Global | Entire room re-render |

Mistakes here create invisible bugs.

---

## 8. Debugging Strategy (Fast)

When something breaks:

1. Check console → did client emit?
2. Check server log → did routeAction match?
3. Check handler → did state change?
4. Check builder → does state map?
5. Check emit → correct socket?

Never debug randomly. Follow the pipeline.

---

## 9. Final Mental Model

> You are not building UI.
> You are designing **state transitions in a live social system**.

If the state transitions are correct → UI will always be correct.
If the state transitions are wrong → UI will feel broken.

---

## 10. One-Line Rule

> "If I didn’t change state, I didn’t build a feature."

---

This is the contract. Break it → chaos.
Follow it → infinite scalability.


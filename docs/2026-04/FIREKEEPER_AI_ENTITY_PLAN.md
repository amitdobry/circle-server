# FireKeeper: AI Entity at the Table

**Created:** 2026-04-07  
**Author:** Amit Abraham Dobry  
**Status:** 🧠 Planning Phase  
**Conflict Risk:** 🟢 Low — independent of SpeakerManager work (Phase B)

---

## 🎯 The Idea in One Line

**OpenClaw (powered by Claude) joins the SoulCircle table as a real participant with the `firekeeper` role — not a chatbot sidebar, but an entity that sits in the circle, points attention, observes the pointerMap, and can speak or guide when conditions are met.**

---

## 🔥 What Is the FireKeeper?

In physical talking circles, the **FireKeeper** holds the sacred space:
- Doesn't dominate conversation
- Observes group dynamics
- Speaks only when truly needed (stuck, lost, unsafe)
- Tends the container, not the content

OpenClaw is the digital FireKeeper:
- Joins as a named participant (`🔥 FireKeeper` or a custom avatar)
- Has full read access to session state (pointerMap, phase, liveSpeaker, participants)
- Can participate in the consensus-pointing mechanism
- Can emit actions through the same socket protocol as human users
- Powered by Claude API on the server side

---

## 🏗️ Architecture: How It Works

### The Core Insight

The existing protocol already has everything needed. OpenClaw is just **a server-side socket client** that connects to its own server and participates like a user — no special bypasses needed.

```
┌─────────────────────────────────────────┐
│              circle-server              │
│                                         │
│  ┌─────────────┐    ┌─────────────────┐ │
│  │ socketHandler│    │  OpenClawService│ │
│  │             │◄───│                 │ │
│  │  (all users)│    │  - Claude API   │ │
│  │             │───►│  - Socket client│ │
│  └─────────────┘    │  - State reader │ │
│                     └─────────────────┘ │
└─────────────────────────────────────────┘
         ▲               ▲
         │               │ (same protocol)
    human users      OpenClaw socket
```

### Connection Model

OpenClaw runs as a **server-side socket client** that connects back to `localhost:3001`. This means:

- It goes through the exact same `join`, `clientEmits`, `pointing` events as humans
- No special code paths — it's just another user from socketHandler's perspective
- Its `role: "firekeeper"` in Engine V2 state gives it special read permissions (already stubbed)

---

## 👤 Identity

| Property | Value |
|---|---|
| `displayName` | `🔥 FireKeeper` (or configurable) |
| `avatarId` | Special reserved avatar (e.g., `firekeeper-001`) |
| `role` | `firekeeper` (already in `ParticipantRole` type) |
| `userId` | `system:firekeeper` (fixed, not auth-based) |
| Authentication | Bypass via trusted internal token (server-to-server) |

---

## 🧠 Behavior Model: When Does OpenClaw Act?

OpenClaw observes and acts based on **triggers**:

### Trigger 1: Session Start
- Joins the room when session starts
- Sends a brief welcome message as `liveSpeaker` if no human has spoken yet
- Then steps back to observer mode

### Trigger 2: Stuck Group (No Consensus for N Minutes)
- `pointerMap` has been fragmented for > 3 minutes with no progress
- OpenClaw points to one participant and says why
- OR emits a gentle prompt ("The circle seems to be finding its center...")

### Trigger 3: Silence After Speaker Drops Mic
- `liveSpeaker` becomes null, nobody points for > 60s
- OpenClaw offers a pointer nudge or a reflection

### Trigger 4: Direct Invocation
- A human points to FireKeeper (`from: humanUser, to: firekeeper`)
- OpenClaw is now consensus candidate — if all point to it, it speaks
- Gives a response based on recent session context (what was said, what gestures were used)

### Trigger 5: Session Ending
- When `phase === "ENDING"`, OpenClaw offers a closing reflection
- Speaks for a fixed time then yields

---

## 🗣️ What Does OpenClaw Say?

It receives a **context window** built from:
- Current `pointerMap` snapshot (who's pointing where)
- Recent `gliffLog` entries (what was said in the session)
- Session `phase` and duration
- Participant count and states

Claude is prompted to respond **as the FireKeeper role** — brief, grounding, non-directive.

**Example system prompt:**
```
You are the FireKeeper of a SoulCircle — a structured group 
communication circle. You are a participant, not a moderator.
Your role: hold space, not fill it.
Speak rarely. When you do, be brief (1-3 sentences max).
Never tell people what to think. Reflect what you observe.
Current session state: {state}
Recent dialogue: {gliffLog}
```

---

## 📦 Implementation: Files to Create

### Phase 1: Basic Presence (No Conflict with Phase B)

**New file:** `server/firekeeper/OpenClawService.ts`
```
- Manages OpenClaw's socket connection to the server
- Handles join/leave lifecycle
- Read-only mode (just joins, no actions yet)
```

**New file:** `server/firekeeper/firekeepereAvatar.ts`
```
- Registers a reserved firekeeper avatar
- Excluded from normal avatar pool
```

**Modify:** `server/avatarManager.ts`
```
- Reserve one avatar slot for firekeeper (never claimed by users)
```

**Modify:** `index.ts`
```
- Initialize OpenClawService after server starts
- Feature-flagged: FIREKEEPER_ENABLED=true
```

### Phase 2: Observation + Claude Integration

**New file:** `server/firekeeper/sessionContextBuilder.ts`
```
- Builds the context window for Claude from TableState + gliffLog
```

**New file:** `server/firekeeper/claudeClient.ts`
```
- Wraps Claude API (Anthropic SDK)
- System prompt management
- Response formatting for SoulCircle
```

### Phase 3: Active Participation

**Modify:** `server/firekeeper/OpenClawService.ts`
```
- Enable trigger detection (stuck group, silence, etc.)
- Emit `clientEmits` and `pointing` events via socket
- Implement "speak" flow: point to self -> consensus -> emit text
```

---

## ⚠️ Conflict Analysis

| Component | Phase B (SpeakerManager) | FireKeeper | Conflict? |
|---|---|---|---|
| `socketHandler.ts` | Modifies `getLiveSpeaker`, `getPointerMap` wrappers | Reads via socket events, not direct import | 🟢 None |
| `actionHandlers/*.ts` | Updates roomId passing | Not touched | 🟢 None |
| `avatarManager.ts` | Not touched | Reserves one slot | 🟡 Minor (test avatar availability) |
| `engine-v2/state/types.ts` | Not touched | Uses `role: "firekeeper"` already there | 🟢 None |
| New files | None | All new files in `server/firekeeper/` | 🟢 None |

**Conclusion: FireKeeper Phase 1 can be built now, completely safely.**  
Phase 2+ can wait for Phase B merge.

---

## 🔧 Environment Variables

```bash
# FireKeeper feature flag
FIREKEEPER_ENABLED=true

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Internal auth token for FireKeeper socket connection
FIREKEEPER_INTERNAL_TOKEN=some-long-secret
```

---

## 🚦 Implementation Order

- [ ] **Step 1:** Reserve firekeeper avatar in `avatarManager.ts`
- [ ] **Step 2:** Create `server/firekeeper/OpenClawService.ts` — joins on session start, leaves on end
- [ ] **Step 3:** Feature flag `FIREKEEPER_ENABLED`, wire into `index.ts`
- [ ] **Step 4:** Verify FireKeeper appears in user list, has correct avatar, role shows in Engine V2
- [ ] **Step 5:** Add `sessionContextBuilder.ts` — build Claude context from state
- [ ] **Step 6:** Add `claudeClient.ts` — API wrapper with system prompt
- [ ] **Step 7:** Wire first trigger: direct invocation (human points to FireKeeper)
- [ ] **Step 8:** Wire passive triggers (stuck group, silence, session end)

---

## 💡 Open Questions

1. **Does FireKeeper participate in consensus?** Can humans point to it and give it the mic? (Yes seems right — it's a real participant)
2. **Can FireKeeper be the ONLY one pointed to?** What if everyone points to FireKeeper but it's trying to yield? (Need a graceful decline flow)
3. **Authentication bypass:** FireKeeper needs to bypass normal user auth. Use a signed internal token checked in `socketHandler`?
4. **Avatar:** Should FireKeeper have a unique visual indicator that it's AI? A subtle `🤖` or a distinct avatar type?
5. **Opt-in or always present?** Does the session creator choose to include FireKeeper?

---

## 🎯 Success Metric

A human participant in a circle cannot tell from the protocol mechanics whether FireKeeper is a person or AI — it participates through the same pointer/consensus/speak flow. The only difference is what it says.

**"The FireKeeper holds the container. The container is the protocol."**

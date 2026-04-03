# VSCode Debug Configurations for Engine V2

These debug configurations make it easy to test and debug the Engine V2 authority shift.

---

## 🎯 Main Debug Configurations

### 🔍 Debug Server (Default SHADOW Mode)

**Use:** Default development mode  
**What it does:** V2 observes V1 without authority  
**Safe for:** Always safe - zero production risk

**Environment:**

- `ENGINE_MODE=SHADOW`

**When to use:**

- Default development
- Learning how V2 works
- Validating V2 state consistency

---

### 🟢 Debug Server (HYBRID - Panel Config)

**Use:** First feature rollout  
**What it does:** V2 controls panel configs only  
**Safe for:** Low-risk initial testing

**Environment:**

- `ENGINE_MODE=HYBRID`
- `ENGINE_V2_PANEL_CONFIG=true`
- `ENGINE_V2_STATE_QUERIES=true`

**When to use:**

- Testing panel configuration from V2
- First real authority handoff
- Week 2 of rollout

**Test by:**

- Joining a session
- Requesting panel configs
- Verifying panels render correctly

---

### 🟡 Debug Server (HYBRID - Medium Risk)

**Use:** Second phase rollout  
**What it does:** V2 controls panels, queries, pointing, speaker, gestures  
**Safe for:** After panel config proven stable

**Environment:**

- `ENGINE_MODE=HYBRID`
- Low-risk features ✅
- Medium-risk features ✅

**When to use:**

- Testing pointing system from V2
- Testing live speaker tracking
- Week 3-4 of rollout

**Test by:**

- Pointing at users
- Clicking gestures
- Checking live speaker updates

---

### 🔴 Debug Server (HYBRID - All Features)

**Use:** Final hybrid testing before full V2  
**What it does:** V2 controls everything via individual flags  
**Safe for:** After medium-risk features proven

**Environment:**

- All 8 feature flags enabled individually

**When to use:**

- Testing session control from V2
- Testing user management from V2
- Week 5 of rollout (pre-full authority)

**Test by:**

- Starting/ending sessions
- Users joining/leaving
- Full session lifecycle

---

### 🚀 Debug Server (V2 FULL AUTHORITY)

**Use:** V2 has complete control  
**What it does:** V2 handles everything, V1 is fallback only  
**Safe for:** After successful hybrid rollout

**Environment:**

- `ENGINE_MODE=V2_FULL`

**When to use:**

- Week 6+ of rollout
- After all features proven stable in HYBRID
- Final production configuration

**Test by:**

- Complete session flows
- Multi-user scenarios
- Edge cases and error conditions

---

### 🔙 Debug Server (V1 ONLY - Rollback)

**Use:** Emergency rollback or V1 comparison  
**What it does:** V2 completely disabled  
**Safe for:** Always (pure V1 behavior)

**Environment:**

- `ENGINE_MODE=V1_ONLY`

**When to use:**

- Emergency rollback testing
- Comparing V1 vs V2 behavior
- Validating V1 still works
- Debugging V1-specific issues

---

## 🧪 Testing & Diagnostic Configurations

### 🧪 Test Feature Flags

**Use:** Validate feature flag configuration  
**What it does:** Runs test script showing current config

**When to use:**

- Verify feature flags load correctly
- Check which features are enabled
- Diagnose configuration issues

**Output shows:**

- Current engine mode
- Shadow mode status
- Effect execution status
- List of enabled features

---

### 🔬 Debug Engine V2 Tests

**Use:** Run Engine V2 unit tests in debug mode  
**What it does:** Debugs mutation boundary and invariant tests

**When to use:**

- Debugging V2 reducer logic
- Validating invariants
- Testing state mutations
- Developing new V2 features

---

## ⚡ Advanced Configurations (Grouped)

### ⚡ Debug Server (Session Control Only)

**Use:** Test session lifecycle in isolation  
**What it does:** Only session control from V2  
**Safe for:** Testing specific feature

**Test by:**

- Start session
- Timer countdown
- Session end
- All session-related events

---

### 👥 Debug Server (User Management Only)

**Use:** Test user join/leave in isolation  
**What it does:** Only user management from V2  
**Safe for:** Testing specific feature

**Test by:**

- User joins
- Avatar claiming
- User leaves
- Disconnects and reconnects

---

## 🎮 How to Use

### Method 1: Debug Panel (Recommended)

1. Press `F5` or click "Run and Debug" icon
2. Click dropdown at top
3. Select desired configuration
4. Click green play button or press `F5`

### Method 2: Command Palette

1. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
2. Type "Debug: Select and Start Debugging"
3. Choose configuration
4. Press Enter

### Method 3: Keyboard Shortcuts

1. Open dropdown in Debug panel
2. Select configuration
3. Press `F5` to start debugging

---

## 🔍 What to Look For When Debugging

### In SHADOW Mode:

```
✅ [Shadow] Dispatching action: JOIN_SESSION
✅ [V2] Room state updated
✅ [V1] continues handling normally
❌ [V2] does NOT emit events
```

### In HYBRID Mode:

```
✅ [V2] Handling feature (enabled)
✅ [V2] Executing effects
✅ [V1] Handling other features (disabled)
✅ Events emitted by V2 for enabled features
```

### In V2_FULL Mode:

```
✅ [V2] Handling ALL features
✅ [V2] Executing ALL effects
⚠️  [V1] Only used on V2 errors
✅ All events from V2
```

### In V1_ONLY Mode:

```
✅ [V1] Handling everything
❌ [V2] Completely silent
❌ No shadow observations
✅ Pure legacy behavior
```

---

## 🐛 Breakpoint Suggestions

### For Shadow Mode Debugging:

- `server/engine-v2/shadow/shadowDispatcher.ts:40` - Shadow dispatch entry
- `server/engine-v2/reducer/dispatch.ts:15` - V2 dispatch entry
- `server/engine-v2/state/invariants.ts:10` - Invariant checks

### For HYBRID Mode Debugging:

- `server/config/featureFlags.ts:145` - shouldUseV2() check
- `server/engine-v2/effects/runEffects.ts:26` - Effect execution
- `server/socketHandler.ts` - Where V1/V2 decisions made

### For Session Control:

- `server/engine-v2/reducer/reducer.ts` - START_SESSION case
- `server/engine-v2/reducer/phaseRules.ts` - Phase transitions

### For User Management:

- `server/engine-v2/reducer/reducer.ts` - JOIN_SESSION case
- `server/engine-v2/reducer/reducer.ts` - DISCONNECT case

---

## 📊 Debugging Workflow

### Testing a New Feature:

1. Start with **SHADOW mode** - observe behavior
2. Switch to **specific feature only** (advanced configs)
3. Test feature thoroughly in isolation
4. Move to **HYBRID with that feature**
5. Add more features gradually
6. Eventually reach **V2_FULL**

### Investigating a Bug:

1. **V1_ONLY** - Does bug exist in pure V1?
2. **SHADOW** - Check V2 logs for discrepancies
3. **HYBRID with feature** - Isolate which feature causes bug
4. Set breakpoints in that feature's code
5. Step through reducer and effect execution

### Comparing V1 vs V2:

1. Run scenario in **V1_ONLY mode** - note behavior
2. Run same scenario in **SHADOW mode** - compare V2 logs
3. Run in **HYBRID** - test actual V2 authority
4. Compare outputs, events, and state

---

## 🎯 Recommended Debug Sequence

**Week 1:**

- 🔍 Debug Server (Default SHADOW Mode)
- 🧪 Test Feature Flags
- Get comfortable with V2 observations

**Week 2:**

- 🟢 Debug Server (HYBRID - Panel Config)
- Test panel configs thoroughly
- Compare with V1 behavior

**Week 3:**

- 🟡 Debug Server (HYBRID - Medium Risk)
- Test pointing and speaker
- Verify gesture routing

**Week 4:**

- ⚡ Debug Server (Session Control Only)
- 👥 Debug Server (User Management Only)
- Test high-risk features in isolation

**Week 5:**

- 🔴 Debug Server (HYBRID - All Features)
- Full integration testing
- All features via individual flags

**Week 6:**

- 🚀 Debug Server (V2 FULL AUTHORITY)
- Production configuration
- Final validation

---

## 💡 Pro Tips

### Tip 1: Use Integrated Terminal

All configs use `"console": "integratedTerminal"` so you see:

- Colorized output
- Feature flag summary at startup
- Easy to read logs

### Tip 2: Modify Environment Variables

You can edit any config and add/remove env vars:

```json
"env": {
  "ENGINE_MODE": "HYBRID",
  "ENGINE_V2_PANEL_CONFIG": "true",
  "NODE_ENV": "development"
}
```

### Tip 3: Create Custom Configs

Copy any configuration and customize:

- Change feature flag combinations
- Add logging verbosity
- Set different ports

### Tip 4: Use Presentation Groups

Advanced configs are in the "advanced" group:

```json
"presentation": {
  "group": "advanced"
}
```

This organizes the debug dropdown.

### Tip 5: Check Startup Logs

Every debug session shows the Engine Configuration:

```
======================================================================
🎛️  ENGINE CONFIGURATION
======================================================================
Mode:              HYBRID
Enabled Features:  PANEL_CONFIG [LOW RISK]
======================================================================
```

Verify this matches your expectations!

---

## 🆘 Troubleshooting

### Debug Config Not Working?

- Check that you're in the `soulcircle-server` folder
- Verify `ts-node` is installed: `npm install ts-node`
- Check file paths in launch.json

### Feature Flag Not Taking Effect?

- Verify env var spelling (case-sensitive!)
- Check startup logs for actual configuration
- Run `🧪 Test Feature Flags` to diagnose

### Can't See Logs?

- Make sure `"console": "integratedTerminal"` is set
- Check the "Debug Console" panel
- Look in the integrated terminal

### Breakpoints Not Hitting?

- Verify file paths in `skipFiles`
- Check that code is actually executed
- Add `debugger;` statement to force break

---

## 📚 Related Documentation

- [FEATURE_FLAGS_QUICKSTART.md](../FEATURE_FLAGS_QUICKSTART.md)
- [server/config/FEATURE_FLAGS_README.md](../server/config/FEATURE_FLAGS_README.md)
- [ENGINE_V2_FEATURE_FLAGS_COMPLETE.md](../ENGINE_V2_FEATURE_FLAGS_COMPLETE.md)

---

**Happy Debugging! 🐛🔍**

Use these configurations to safely test and debug the Engine V2 authority shift.

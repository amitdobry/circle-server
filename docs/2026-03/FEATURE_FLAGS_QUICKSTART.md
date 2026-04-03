# Engine V2 Feature Flags - Quick Start Guide

**Get started with the Engine V2 authority shift in 5 minutes!**

---

## 🚀 Quick Start (3 Steps)

### Step 1: Check Current Mode

```bash
cd soulcircle-server
npx ts-node test-feature-flags.ts
```

**Expected output:**

```
✅ Engine Mode: SHADOW
✅ Shadow Mode Active: true
✅ Execute V2 Effects: false
✅ Enabled Features (0): []
```

✅ **Default is SHADOW mode** - V2 observes safely without controlling anything.

---

### Step 2: Start Server (Shadow Mode)

```bash
npm run dev
```

**Look for this in the console:**

```
======================================================================
🎛️  ENGINE CONFIGURATION
======================================================================
Mode:              SHADOW
Shadow Active:     true
Execute Effects:   false
Enabled Features:  None
======================================================================
```

✅ **Server is running** - V2 is observing V1 in shadow mode!

---

### Step 3: Enable Your First Feature (Optional)

When ready to give V2 authority over panel configs:

**Create or edit `.env` file:**

```bash
ENGINE_MODE=HYBRID
ENGINE_V2_PANEL_CONFIG=true
```

**Restart server:**

```bash
npm run dev
```

**You should see:**

```
======================================================================
🎛️  ENGINE CONFIGURATION
======================================================================
Mode:              HYBRID
Shadow Active:     true
Execute Effects:   true
Enabled Features:
  ✓ PANEL_CONFIG [LOW RISK]
======================================================================
```

✅ **V2 now controls panel configs!**

---

## 🎛️ Environment Variable Reference

### Quick Copy-Paste Configs

#### Option 1: Shadow Mode (Default - Safe)

```bash
# No configuration needed - this is the default
# Or explicitly set:
ENGINE_MODE=SHADOW
```

**Use case:** Default mode. V2 observes V1 safely.

---

#### Option 2: Hybrid Mode - Panel Config Only

```bash
ENGINE_MODE=HYBRID
ENGINE_V2_PANEL_CONFIG=true
ENGINE_V2_STATE_QUERIES=true
```

**Use case:** First real feature rollout (low risk).

---

#### Option 3: Hybrid Mode - Medium Risk Features

```bash
ENGINE_MODE=HYBRID
ENGINE_V2_PANEL_CONFIG=true
ENGINE_V2_STATE_QUERIES=true
ENGINE_V2_POINTING=true
ENGINE_V2_LIVE_SPEAKER=true
```

**Use case:** Second phase rollout.

---

#### Option 4: Full V2 Authority

```bash
ENGINE_MODE=V2_FULL
```

**Use case:** After successful hybrid testing, V2 controls everything.

---

#### Option 5: Emergency Rollback

```bash
ENGINE_MODE=V1_ONLY
```

**Use case:** Something broke, disable V2 immediately!

---

## 🧪 Testing Different Modes

### Test without restarting server:

```bash
# Test SHADOW mode (default)
npx ts-node test-feature-flags.ts

# Test HYBRID mode
$env:ENGINE_MODE='HYBRID'; $env:ENGINE_V2_PANEL_CONFIG='true'; npx ts-node test-feature-flags.ts

# Test V2_FULL mode
$env:ENGINE_MODE='V2_FULL'; npx ts-node test-feature-flags.ts

# Test V1_ONLY mode (emergency rollback)
$env:ENGINE_MODE='V1_ONLY'; npx ts-node test-feature-flags.ts
```

---

## 📝 Using in Code

### Basic Example

```typescript
import { shouldUseV2 } from "./server/config/featureFlags";

// In your socket handler:
socket.on("request:panelConfig", ({ userName }) => {
  if (shouldUseV2("PANEL_CONFIG")) {
    // ✨ V2 has authority
    handleWithV2(userName);
  } else {
    // 📜 V1 fallback
    handleWithV1(userName);
  }
});
```

### Check Shadow Mode

```typescript
import { isShadowModeActive } from "./server/config/featureFlags";

if (isShadowModeActive()) {
  // V2 is observing (SHADOW or HYBRID mode)
  shadowDispatch(roomId, userId, action);
}
```

### Full Example (Session Control)

```typescript
import {
  shouldUseV2,
  shouldExecuteV2Effects,
} from "./server/config/featureFlags";
import { dispatch } from "./server/engine-v2/reducer/dispatch";
import { runEffects } from "./server/engine-v2/effects/runEffects";

socket.on("start-session", ({ durationMinutes }) => {
  if (shouldUseV2("SESSION_CONTROL")) {
    // V2 has authority
    const effects = dispatch(roomId, userId, {
      type: "START_SESSION",
      payload: { durationMinutes },
    });

    if (shouldExecuteV2Effects()) {
      runEffects(effects, io);
    }
  } else {
    // V1 fallback
    startSessionV1(durationMinutes);
  }
});
```

---

## ⚡ Common Tasks

### See Current Configuration

```typescript
import { getConfigSummary } from "./server/config/featureFlags";

const config = getConfigSummary();
console.log(config);
```

### Runtime Override (Testing Only)

```typescript
import { overrideFeatureFlag } from "./server/config/featureFlags";

// ⚠️ For testing only - bypasses environment config
overrideFeatureFlag("PANEL_CONFIG", true);
```

---

## 🔍 Monitoring

### Startup Logs

Every time the server starts, you'll see the engine configuration:

```
======================================================================
🎛️  ENGINE CONFIGURATION
======================================================================
Mode:              HYBRID
Shadow Active:     true
Execute Effects:   true
Enabled Features:  3
  ✓ PANEL_CONFIG         [LOW RISK]
  ✓ STATE_QUERIES        [LOW RISK]
  ✓ POINTING             [MEDIUM RISK]
======================================================================
```

### Check Logs for V2 Activity

Look for these log prefixes:

- `[V2]` - V2 is handling an operation
- `[V1]` - V1 is handling an operation (legacy)
- `[Shadow]` - V2 is observing in shadow mode

---

## 🛡️ Safety Features

1. **Default is SHADOW** - Zero risk by default
2. **Environment-based** - Change config without code changes
3. **Instant rollback** - Set `ENGINE_MODE=V1_ONLY` and restart
4. **Granular control** - Enable features one at a time
5. **Clear visibility** - Startup diagnostics show exactly what's enabled

---

## 📚 Full Documentation

- [FEATURE_FLAGS_README.md](./server/config/FEATURE_FLAGS_README.md) - Complete guide
- [FEATURE_FLAG_IMPLEMENTATION_SUMMARY.md](./FEATURE_FLAG_IMPLEMENTATION_SUMMARY.md) - What was built
- [socketHandlerIntegrationExamples.ts](./server/config/socketHandlerIntegrationExamples.ts) - Code patterns

---

## 🎯 Recommended Path

**Week 1:** Run in SHADOW mode ← **START HERE**

```bash
# Just start the server - no configuration needed
npm run dev
```

**Week 2:** Enable panel config (low risk)

```bash
# Add to .env:
ENGINE_MODE=HYBRID
ENGINE_V2_PANEL_CONFIG=true
```

**Week 3:** Add pointing system (medium risk)

```bash
# Add to .env:
ENGINE_V2_POINTING=true
ENGINE_V2_LIVE_SPEAKER=true
```

**Week 4-5:** Gradually enable remaining features

**Week 6:** Full V2 authority

```bash
# Set in .env:
ENGINE_MODE=V2_FULL
```

---

## ❓ FAQ

**Q: What's the default mode?**  
A: SHADOW mode. V2 observes V1 without controlling anything.

**Q: How do I disable V2 completely?**  
A: Set `ENGINE_MODE=V1_ONLY` in `.env` and restart.

**Q: Can I enable features without HYBRID mode?**  
A: No. Individual feature flags only work in HYBRID mode.

**Q: What happens if I enable SESSION_CONTROL too early?**  
A: V2 will control sessions, but V1 is still available as fallback. Test thoroughly first!

**Q: How do I know which engine is handling what?**  
A: Check the startup logs and look for `[V2]` vs `[V1]` prefixes in runtime logs.

---

## 🚨 Emergency Procedures

### If Something Goes Wrong

1. **Stop the server** (Ctrl+C)

2. **Set emergency rollback:**

   ```bash
   # In .env file:
   ENGINE_MODE=V1_ONLY
   ```

3. **Restart server:**

   ```bash
   npm run dev
   ```

4. **Verify rollback:**
   Look for this in startup logs:
   ```
   Mode: V1_ONLY
   ⚠️ WARNING: Engine V2 is COMPLETELY DISABLED
   ```

✅ **You're back to pure V1 behavior!**

---

## ✅ Checklist

Before going to production:

- [ ] Test in SHADOW mode for at least 1 week
- [ ] Review shadow mode logs for issues
- [ ] Run `test-feature-flags.ts` to verify configuration
- [ ] Start with low-risk features first (PANEL_CONFIG)
- [ ] Monitor closely when enabling each new feature
- [ ] Have emergency rollback plan ready
- [ ] Document which features are enabled in production

---

**Ready to start? Run:**

```bash
cd soulcircle-server
npm run dev
```

**You're now in SHADOW mode by default! 🎉**

---

**Last Updated:** March 5, 2026

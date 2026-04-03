# Engine V2 Feature Flags Guide

## 🎯 Purpose

This feature flag system controls the gradual authority shift from **Engine V1** (legacy imperative code in `socketHandler.ts`) to **Engine V2** (event-sourced architecture in `engine-v2/`).

## 🚦 Engine Modes

### 1. **SHADOW** (Default - Safe Mode)

```bash
ENGINE_MODE=SHADOW
```

- ✅ V2 **observes** V1 events (shadow mode)
- ⚠️ V2 has **NO authority** (doesn't control anything)
- 📊 Perfect for validation and testing
- 🛡️ Zero risk to production

**Use case:** Default mode. V2 learns from traffic without affecting users.

---

### 2. **HYBRID** (Gradual Rollout)

```bash
ENGINE_MODE=HYBRID
ENGINE_V2_PANEL_CONFIG=true
ENGINE_V2_STATE_QUERIES=true
```

- ✅ V2 has authority over **specific features** only
- ⚠️ V1 handles everything else
- 📊 Enables gradual, feature-by-feature rollout
- 🛡️ Low risk - can enable safe features first

**Use case:** Production rollout. Start with low-risk features (panel config), gradually enable more.

---

### 3. **V2_FULL** (Complete Authority)

```bash
ENGINE_MODE=V2_FULL
```

- ✅ V2 has **full authority** over all features
- ⚠️ V1 only used as **emergency fallback**
- 📊 V2 is the primary engine
- 🛡️ Medium risk - requires thorough testing

**Use case:** After successful HYBRID rollout and validation.

---

### 4. **V1_ONLY** (Emergency Rollback)

```bash
ENGINE_MODE=V1_ONLY
```

- ✅ V2 **completely disabled**
- ⚠️ No shadow observation
- 📊 Pure V1 behavior (legacy)
- 🛡️ Emergency fallback only

**Use case:** If critical V2 issues are discovered, instant rollback.

---

## 🎛️ Feature Flags (HYBRID Mode)

When `ENGINE_MODE=HYBRID`, you can enable V2 authority for specific features:

### Low Risk (Safe to enable first)

```bash
ENGINE_V2_PANEL_CONFIG=true        # Panel configuration generation
ENGINE_V2_STATE_QUERIES=true       # V1 reads state from V2
ENGINE_V2_GLIFF_LOGGING=true       # Gliff log creation
```

### Medium Risk

```bash
ENGINE_V2_POINTING=true            # Attention/pointing system
ENGINE_V2_LIVE_SPEAKER=true        # Live speaker tracking
ENGINE_V2_GESTURE_ROUTING=true     # Gesture event routing
```

### High Risk (Enable last, after extensive testing)

```bash
ENGINE_V2_SESSION_CONTROL=true     # Session start/end/timer
ENGINE_V2_USER_MANAGEMENT=true     # User join/leave/avatar claiming
```

---

## 📝 Usage in Code

### Basic Usage

```typescript
import { shouldUseV2, isShadowModeActive } from "./config/featureFlags";

socket.on("request:panelConfig", ({ userName }) => {
  if (shouldUseV2("PANEL_CONFIG")) {
    // ✨ V2 has authority
    const config = await getPanelConfigFromV2(userName);
    socket.emit("receive:panelConfig", config);
  } else {
    // 📜 V1 fallback
    const config = getPanelConfigFor(userName);
    socket.emit("receive:panelConfig", config);
  }

  // Shadow observation (runs regardless of authority)
  if (isShadowModeActive()) {
    shadowDispatch(roomId, userId, action);
  }
});
```

### With Effect Execution

```typescript
import { shouldUseV2, shouldExecuteV2Effects } from "./config/featureFlags";
import { dispatch } from "./engine-v2/reducer/dispatch";
import { runEffects } from "./engine-v2/effects/runEffects";

socket.on("start-session", ({ durationMinutes }) => {
  if (shouldUseV2("SESSION_CONTROL")) {
    // V2 has authority - dispatch and execute effects
    const effects = dispatch(roomId, userId, action);

    if (shouldExecuteV2Effects()) {
      runEffects(effects, io, roomRegistry);
    }
  } else {
    // V1 fallback
    startSessionWithDuration(io, durationMinutes);
  }
});
```

---

## 🔄 Rollout Sequence (Recommended)

### Week 1: Shadow Validation

```bash
ENGINE_MODE=SHADOW
```

- V2 observes all traffic
- Compare V2 state with V1 state
- Fix any discrepancies
- Validate invariants hold

### Week 2: Panel Config (Low Risk)

```bash
ENGINE_MODE=HYBRID
ENGINE_V2_PANEL_CONFIG=true
ENGINE_V2_STATE_QUERIES=true
```

- Enable low-risk features
- Monitor for issues
- Validate panel configs match expected

### Week 3: Pointing System (Medium Risk)

```bash
ENGINE_MODE=HYBRID
ENGINE_V2_PANEL_CONFIG=true
ENGINE_V2_STATE_QUERIES=true
ENGINE_V2_POINTING=true
ENGINE_V2_LIVE_SPEAKER=true
```

- Add pointing and speaker tracking
- Monitor pointer map accuracy
- Validate live speaker transitions

### Week 4: Session Control (High Risk)

```bash
ENGINE_MODE=HYBRID
ENGINE_V2_PANEL_CONFIG=true
ENGINE_V2_STATE_QUERIES=true
ENGINE_V2_POINTING=true
ENGINE_V2_LIVE_SPEAKER=true
ENGINE_V2_SESSION_CONTROL=true
```

- Enable session lifecycle
- Test timer accuracy
- Validate phase transitions

### Week 5: Full Authority

```bash
ENGINE_MODE=V2_FULL
```

- V2 controls everything
- V1 is fallback only
- Monitor closely for 1-2 weeks

### Week 6: Deprecate V1

- Remove V1 code gradually
- Keep as archived fallback for safety

---

## 🔍 Monitoring

### Startup Logs

When the server starts, you'll see:

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

### Runtime Diagnostics

```typescript
import { getConfigSummary } from './config/featureFlags';

// Get complete config
const config = getConfigSummary();
console.log(config);

// Output:
{
  mode: 'HYBRID',
  shadowActive: true,
  executeEffects: true,
  enabledFeatures: ['PANEL_CONFIG', 'STATE_QUERIES', 'POINTING'],
  featureDetails: { ... }
}
```

---

## ⚠️ Emergency Rollback

If issues are discovered:

1. **Immediate:** Set `ENGINE_MODE=V1_ONLY` in .env
2. **Restart server**
3. **V2 completely disabled**
4. **Debug offline**

```bash
# .env
ENGINE_MODE=V1_ONLY  # Emergency rollback
```

---

## 🧪 Testing

### Test Shadow Mode

```bash
ENGINE_MODE=SHADOW npm run dev
```

Check logs for shadow observations without authority.

### Test Specific Feature

```bash
ENGINE_MODE=HYBRID
ENGINE_V2_PANEL_CONFIG=true
npm run dev
```

Verify panel configs come from V2.

### Test Full V2

```bash
ENGINE_MODE=V2_FULL npm run dev
```

Verify all features work with V2 in control.

---

## 🏗️ Architecture Impact

### Before (V1 Only)

```
Client → Socket Event → socketHandler.ts (V1) → Emit Response
```

### Shadow Mode

```
Client → Socket Event → socketHandler.ts (V1) → Emit Response
                              ↓
                       shadowDispatch (V2 observes)
```

### Hybrid Mode

```
Client → Socket Event → Feature Flag Check
                              ↓
                   ┌──────────┴──────────┐
                   ↓                     ↓
              V2 Handler            V1 Fallback
                   ↓                     ↓
              Execute Effects       Direct Response
```

### V2 Full Authority

```
Client → Socket Event → V2 Handler → Execute Effects
                              ↓
                         (V1 fallback only on error)
```

---

## 📚 Additional Resources

- [ENGINE_V2_SHADOW_INTEGRATION_GUIDE.md](../../ENGINE_V2_SHADOW_INTEGRATION_GUIDE.md)
- [ENGINE_V2_IMPLEMENTATION_STATUS_AND_ROADMAP.md](../../ENGINE_V2_IMPLEMENTATION_STATUS_AND_ROADMAP.md)
- [SHADOW_MODE_QUICKSTART.md](../../SHADOW_MODE_QUICKSTART.md)

---

## 🤝 Contributing

When adding new features:

1. Add feature flag to `featureFlags.ts`
2. Set risk level appropriately
3. Add to .env.example
4. Document in this README
5. Use `shouldUseV2('YOUR_FEATURE')` in code
6. Start in shadow mode, graduate to hybrid

---

**Last Updated:** March 5, 2026

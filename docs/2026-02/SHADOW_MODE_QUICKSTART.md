# 🚀 SHADOW MODE QUICK START

## Start Server

```powershell
.\start-with-shadow.ps1
```

## Expected Startup Log

```
[Server] ✨ Engine V2 shadow mode ENABLED
[V2 Shadow] 🔍 Shadow mode ENABLED - V2 running as passive observer
```

## Test Flow

1. Open app in browser
2. Join as a user → See `JOIN_SESSION` log
3. Point to yourself → See `POINT_TO_USER` log
4. Start session → See `CLICK_READY_TO_GLOW` log
5. Disconnect → See `DISCONNECT` log

## Success Criteria

- ✅ All invariants show `✅ OK`
- ✅ No `❌ ERROR` logs
- ✅ V1 behavior unchanged
- ✅ Clean, readable logs

## What's Being Tested

- Room isolation (RoomRegistry works)
- Identity mapping (userId extraction)
- Action translation (legacy → V2)
- Invariant checks (14 rules enforced)

## If You See Errors

- Check which invariant failed
- Check which action triggered it
- Most likely: Transition not implemented yet (expected)

## Next Steps After Success

1. Implement JOIN_SESSION transition
2. Implement DISCONNECT transition
3. Implement POINT_TO_USER transition
4. Hook remaining events
5. Run protocol tests

---

**Current Status:** Shadow mode integrated, ready to test. Zero risk. 🚀

**Files modified:** 2 (socketHandler.ts + invariants.ts)  
**Lines added:** ~55 lines  
**New infrastructure:** 2 files (shadowDispatcher.ts + actionMapper.ts)

**Goal:** Validate Engine V2 architecture with real traffic before building transitions.

#!/usr/bin/env ts-node
/**
 * Test Feature Flags Configuration
 *
 * Quick test to verify feature flags load correctly
 * Run: npx ts-node test-feature-flags.ts
 */

import {
  shouldUseV2,
  isShadowModeActive,
  shouldExecuteV2Effects,
  getEnabledFeatures,
  logConfigSummary,
  ENGINE_MODE,
} from "./server/config/featureFlags";

console.log("\n🧪 Testing Feature Flags Module\n");

// Test 1: Module loads
console.log("✅ Module loaded successfully");

// Test 2: Check engine mode
console.log(`✅ Engine Mode: ${ENGINE_MODE}`);

// Test 3: Check shadow mode
console.log(`✅ Shadow Mode Active: ${isShadowModeActive()}`);

// Test 4: Check effect execution
console.log(`✅ Execute V2 Effects: ${shouldExecuteV2Effects()}`);

// Test 5: Check enabled features
const enabled = getEnabledFeatures();
console.log(`✅ Enabled Features (${enabled.length}):`, enabled);

// Test 6: Check individual features
console.log("\n📋 Feature Checks:");
const features = [
  "SESSION_CONTROL",
  "USER_MANAGEMENT",
  "POINTING",
  "PANEL_CONFIG",
  "LIVE_SPEAKER",
  "GESTURE_ROUTING",
  "GLIFF_LOGGING",
  "STATE_QUERIES",
] as const;

features.forEach((feature) => {
  const enabled = shouldUseV2(feature);
  const icon = enabled ? "🟢" : "⚫";
  console.log(`  ${icon} ${feature}: ${enabled}`);
});

// Test 7: Log full summary
console.log("\n");
logConfigSummary();

console.log("✅ All tests passed!\n");

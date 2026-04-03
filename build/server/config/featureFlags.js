"use strict";
/**
 * Feature Flags: Engine V1 vs Engine V2 Authority Control
 *
 * This module controls the gradual authority shift from the legacy Engine V1
 * (in socketHandler.ts) to the new event-sourced Engine V2 (in engine-v2/).
 *
 * Usage:
 *   import { shouldUseV2, EngineMode } from './config/featureFlags';
 *
 *   if (shouldUseV2('SESSION_CONTROL')) {
 *     // Use V2 logic
 *   } else {
 *     // Use V1 logic (fallback)
 *   }
 *
 * Modes:
 *   - SHADOW: V2 observes V1 (no authority, validation only)
 *   - HYBRID: V2 has authority over specific features
 *   - V2_FULL: V2 has full authority (V1 is fallback only)
 *   - V1_ONLY: V2 disabled (emergency rollback)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENGINE_MODE = void 0;
exports.shouldUseV2 = shouldUseV2;
exports.isShadowModeActive = isShadowModeActive;
exports.shouldExecuteV2Effects = shouldExecuteV2Effects;
exports.getEnabledFeatures = getEnabledFeatures;
exports.getConfigSummary = getConfigSummary;
exports.logConfigSummary = logConfigSummary;
exports.overrideFeatureFlag = overrideFeatureFlag;
exports.clearOverrides = clearOverrides;
const FEATURE_FLAGS = {
    SESSION_CONTROL: {
        enabled: parseEnvBoolean("ENGINE_V2_SESSION_CONTROL", false),
        description: "V2 controls session lifecycle (start, timer, end)",
        risk: "high",
    },
    USER_MANAGEMENT: {
        enabled: parseEnvBoolean("ENGINE_V2_USER_MANAGEMENT", false),
        description: "V2 handles user join/leave/avatar logic",
        risk: "high",
    },
    POINTING: {
        enabled: parseEnvBoolean("ENGINE_V2_POINTING", false),
        description: "V2 manages attention/pointing system",
        risk: "medium",
    },
    PANEL_CONFIG: {
        enabled: parseEnvBoolean("ENGINE_V2_PANEL_CONFIG", false),
        description: "V2 generates panel configurations",
        risk: "low",
    },
    LIVE_SPEAKER: {
        enabled: parseEnvBoolean("ENGINE_V2_LIVE_SPEAKER", false),
        description: "V2 tracks live speaker state",
        risk: "medium",
    },
    GESTURE_ROUTING: {
        enabled: parseEnvBoolean("ENGINE_V2_GESTURE_ROUTING", false),
        description: "V2 handles gesture event routing",
        risk: "medium",
    },
    GLIFF_LOGGING: {
        enabled: parseEnvBoolean("ENGINE_V2_GLIFF_LOGGING", false),
        description: "V2 creates and manages gliff logs",
        risk: "low",
    },
    STATE_QUERIES: {
        enabled: parseEnvBoolean("ENGINE_V2_STATE_QUERIES", false),
        description: "V1 queries V2 for state instead of maintaining its own",
        risk: "low",
    },
};
// ============================================================================
// ENGINE MODE
// ============================================================================
/**
 * Determines the overall engine mode based on environment variables
 */
function getEngineMode() {
    const modeEnv = process.env.ENGINE_MODE?.toUpperCase();
    // Explicit mode setting
    if (modeEnv === "V1_ONLY")
        return "V1_ONLY";
    if (modeEnv === "SHADOW")
        return "SHADOW";
    if (modeEnv === "HYBRID")
        return "HYBRID";
    if (modeEnv === "V2_FULL")
        return "V2_FULL";
    // Legacy compatibility
    if (parseEnvBoolean("ENGINE_V2_FULL_AUTHORITY", false))
        return "V2_FULL";
    if (parseEnvBoolean("ENGINE_V2_ENABLED", false))
        return "HYBRID";
    if (parseEnvBoolean("ENGINE_V2_SHADOW", true))
        return "SHADOW";
    // Default: Shadow mode (safe observation)
    return "SHADOW";
}
exports.ENGINE_MODE = getEngineMode();
// ============================================================================
// PUBLIC API
// ============================================================================
/**
 * Check if V2 should be used for a specific feature
 *
 * @param feature - The feature to check
 * @returns true if V2 should handle this feature, false if V1 should
 */
function shouldUseV2(feature) {
    // V1_ONLY mode: Always use V1
    if (exports.ENGINE_MODE === "V1_ONLY") {
        return false;
    }
    // SHADOW mode: Never use V2 for authority (observation only)
    if (exports.ENGINE_MODE === "SHADOW") {
        return false;
    }
    // V2_FULL mode: Always use V2
    if (exports.ENGINE_MODE === "V2_FULL") {
        return true;
    }
    // HYBRID mode: Check individual feature flags
    return FEATURE_FLAGS[feature]?.enabled ?? false;
}
/**
 * Check if shadow mode is active (V2 observes but doesn't control)
 */
function isShadowModeActive() {
    return exports.ENGINE_MODE === "SHADOW" || exports.ENGINE_MODE === "HYBRID";
}
/**
 * Check if V2 should execute effects (has any authority)
 */
function shouldExecuteV2Effects() {
    return exports.ENGINE_MODE === "HYBRID" || exports.ENGINE_MODE === "V2_FULL";
}
/**
 * Get all enabled features in current mode
 */
function getEnabledFeatures() {
    if (exports.ENGINE_MODE === "V1_ONLY")
        return [];
    if (exports.ENGINE_MODE === "V2_FULL") {
        return Object.keys(FEATURE_FLAGS);
    }
    return Object.keys(FEATURE_FLAGS).filter((feature) => FEATURE_FLAGS[feature].enabled);
}
/**
 * Get complete configuration summary (for diagnostics)
 */
function getConfigSummary() {
    return {
        mode: exports.ENGINE_MODE,
        shadowActive: isShadowModeActive(),
        executeEffects: shouldExecuteV2Effects(),
        enabledFeatures: getEnabledFeatures(),
        featureDetails: FEATURE_FLAGS,
    };
}
/**
 * Log configuration at startup
 */
function logConfigSummary() {
    const summary = getConfigSummary();
    console.log("\n" + "=".repeat(70));
    console.log("🎛️  ENGINE CONFIGURATION");
    console.log("=".repeat(70));
    console.log(`Mode:              ${summary.mode}`);
    console.log(`Shadow Active:     ${summary.shadowActive}`);
    console.log(`Execute Effects:   ${summary.executeEffects}`);
    console.log(`Enabled Features:  ${summary.enabledFeatures.length > 0 ? "" : "None"}`);
    if (summary.enabledFeatures.length > 0) {
        summary.enabledFeatures.forEach((feature) => {
            const config = FEATURE_FLAGS[feature];
            console.log(`  ✓ ${feature.padEnd(20)} [${config.risk.toUpperCase()} RISK]`);
        });
    }
    console.log("=".repeat(70) + "\n");
    // Warnings
    if (exports.ENGINE_MODE === "V2_FULL") {
        console.log("⚠️  WARNING: Engine V2 has FULL AUTHORITY");
        console.log("   V1 will only be used as emergency fallback\n");
    }
    if (exports.ENGINE_MODE === "V1_ONLY") {
        console.log("⚠️  WARNING: Engine V2 is COMPLETELY DISABLED");
        console.log("   No shadow observation or validation\n");
    }
}
// ============================================================================
// UTILITIES
// ============================================================================
/**
 * Parse environment variable as boolean
 */
function parseEnvBoolean(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined)
        return defaultValue;
    return value.toLowerCase() === "true" || value === "1";
}
/**
 * Runtime flag override (for testing/emergencies)
 * WARNING: Use with caution - bypasses environment config
 */
let RUNTIME_OVERRIDES = {};
function overrideFeatureFlag(feature, enabled) {
    console.warn(`⚠️  Runtime override: ${feature} = ${enabled}`);
    RUNTIME_OVERRIDES[feature] = enabled;
}
function clearOverrides() {
    RUNTIME_OVERRIDES = {};
    console.log("✓ Cleared all runtime overrides");
}
// ============================================================================
// EXPORTS
// ============================================================================
// Types are already exported above, just export the default object
exports.default = {
    shouldUseV2,
    isShadowModeActive,
    shouldExecuteV2Effects,
    getEnabledFeatures,
    getConfigSummary,
    logConfigSummary,
    ENGINE_MODE: exports.ENGINE_MODE,
};

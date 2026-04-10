"use strict";
/**
 * Engine V2: Dispatch
 *
 * The ONLY entry point for state mutations.
 * All actions flow through this function.
 *
 * Flow:
 * 1. Validate room exists
 * 2. Check permissions (can user perform this action?)
 * 3. Route to reducer
 * 4. Assert invariants
 * 5. Return effects
 *
 * CRITICAL: dispatch() does NOT execute effects.
 * It returns them for the caller to execute via runEffects().
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatch = dispatch;
exports.dispatchAndRun = dispatchAndRun;
const invariants_1 = require("../state/invariants");
const RoomRegistry_1 = require("../registry/RoomRegistry");
const reducer_1 = require("./reducer");
// ============================================================================
// DISPATCH (Main Entry Point)
// ============================================================================
/**
 * Dispatch an action to a room.
 *
 * @param roomId - The room to dispatch to
 * @param userId - The user performing the action (null for system actions)
 * @param action - The action to perform
 * @returns Array of effects to execute
 */
function dispatch(roomId, userId, action) {
    // =========================================================================
    // 1. VALIDATE ROOM EXISTS
    // =========================================================================
    const room = RoomRegistry_1.roomRegistry.getOrCreateRoom(roomId);
    // =========================================================================
    // 2. PERMISSION CHECK (OPTIONAL - Let reducer handle validation)
    // =========================================================================
    // NOTE: Permission checks are now handled in the reducer transitions.
    // This allows more granular control and better error messages.
    // If a user doesn't exist, the reducer will handle it gracefully.
    // System actions (userId = null) always allowed
    // User actions are validated by the reducer transitions
    // =========================================================================
    // 3. ROUTE TO REDUCER
    // =========================================================================
    const effects = (0, reducer_1.reducer)(room, userId, action);
    // Update lastUpdated timestamp
    room.lastUpdated = Date.now();
    // =========================================================================
    // 4. ASSERT INVARIANTS (Development Mode Only)
    // =========================================================================
    try {
        (0, invariants_1.assertInvariantsIfDev)(room);
    }
    catch (error) {
        console.error(`[dispatch] Invariant violation after ${action.type}:`, error);
        // In development, throw to catch bugs early
        if (process.env.NODE_ENV !== "production") {
            throw error;
        }
        // In production, log error but continue
        return [
            {
                type: "SYSTEM_LOG",
                roomId,
                message: `Critical error: invariant violation after ${action.type}`,
                level: "error",
            },
        ];
    }
    // =========================================================================
    // 5. RETURN EFFECTS
    // =========================================================================
    return effects;
}
// ============================================================================
// HELPER: Dispatch and Run Effects (Convenience Function)
// ============================================================================
/**
 * Dispatch an action and immediately run the effects.
 * This is a convenience function for common use cases.
 *
 * @param roomId - The room to dispatch to
 * @param userId - The user performing the action
 * @param action - The action to perform
 * @param io - Socket.IO server instance
 */
function dispatchAndRun(roomId, userId, action, io) {
    const effects = dispatch(roomId, userId, action);
    // Import runEffects dynamically to avoid circular dependency
    Promise.resolve().then(() => __importStar(require("../effects/runEffects"))).then(({ runEffects }) => {
        runEffects(effects, io);
    });
}

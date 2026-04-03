"use strict";
/**
 * Engine V2: Public API
 *
 * Main entry point for the SoulCircle multiplayer state engine.
 * Import this module to use the engine.
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
exports.canPerformAction = exports.runEffects = exports.ActionTypes = exports.serializePointerMap = exports.serializeParticipants = exports.getTakenAvatars = exports.isAvatarAvailable = exports.shouldCleanup = exports.isInGracePeriod = exports.getRemainingTime = exports.isTimerExpired = exports.hasConsensus = exports.evaluateConsensus = exports.getVoteCounts = exports.getPointersToTarget = exports.getPointerTarget = exports.getLiveSpeaker = exports.getParticipantBySocketId = exports.getParticipant = exports.getGhostParticipants = exports.getConnectedParticipants = exports.INVARIANT_DESCRIPTIONS = exports.assertInvariantsIfDev = exports.assertInvariants = exports.SYNC_PAUSE_DURATION_MS = exports.GRACE_PERIOD_MS = exports.DEFAULT_SESSION_DURATION_MS = exports.createActiveTimer = exports.createInactiveTimer = exports.createParticipantState = exports.createInitialTableState = exports.InvariantViolation = exports.roomRegistry = exports.dispatchAndRun = exports.dispatch = void 0;
// ============================================================================
// CORE DISPATCH
// ============================================================================
var dispatch_1 = require("./reducer/dispatch");
Object.defineProperty(exports, "dispatch", { enumerable: true, get: function () { return dispatch_1.dispatch; } });
Object.defineProperty(exports, "dispatchAndRun", { enumerable: true, get: function () { return dispatch_1.dispatchAndRun; } });
// ============================================================================
// REGISTRY
// ============================================================================
var RoomRegistry_1 = require("./registry/RoomRegistry");
Object.defineProperty(exports, "roomRegistry", { enumerable: true, get: function () { return RoomRegistry_1.roomRegistry; } });
var types_1 = require("./state/types");
Object.defineProperty(exports, "InvariantViolation", { enumerable: true, get: function () { return types_1.InvariantViolation; } });
// ============================================================================
// STATE UTILITIES
// ============================================================================
var defaults_1 = require("./state/defaults");
Object.defineProperty(exports, "createInitialTableState", { enumerable: true, get: function () { return defaults_1.createInitialTableState; } });
Object.defineProperty(exports, "createParticipantState", { enumerable: true, get: function () { return defaults_1.createParticipantState; } });
Object.defineProperty(exports, "createInactiveTimer", { enumerable: true, get: function () { return defaults_1.createInactiveTimer; } });
Object.defineProperty(exports, "createActiveTimer", { enumerable: true, get: function () { return defaults_1.createActiveTimer; } });
Object.defineProperty(exports, "DEFAULT_SESSION_DURATION_MS", { enumerable: true, get: function () { return defaults_1.DEFAULT_SESSION_DURATION_MS; } });
Object.defineProperty(exports, "GRACE_PERIOD_MS", { enumerable: true, get: function () { return defaults_1.GRACE_PERIOD_MS; } });
Object.defineProperty(exports, "SYNC_PAUSE_DURATION_MS", { enumerable: true, get: function () { return defaults_1.SYNC_PAUSE_DURATION_MS; } });
var invariants_1 = require("./state/invariants");
Object.defineProperty(exports, "assertInvariants", { enumerable: true, get: function () { return invariants_1.assertInvariants; } });
Object.defineProperty(exports, "assertInvariantsIfDev", { enumerable: true, get: function () { return invariants_1.assertInvariantsIfDev; } });
Object.defineProperty(exports, "INVARIANT_DESCRIPTIONS", { enumerable: true, get: function () { return invariants_1.INVARIANT_DESCRIPTIONS; } });
var selectors_1 = require("./state/selectors");
Object.defineProperty(exports, "getConnectedParticipants", { enumerable: true, get: function () { return selectors_1.getConnectedParticipants; } });
Object.defineProperty(exports, "getGhostParticipants", { enumerable: true, get: function () { return selectors_1.getGhostParticipants; } });
Object.defineProperty(exports, "getParticipant", { enumerable: true, get: function () { return selectors_1.getParticipant; } });
Object.defineProperty(exports, "getParticipantBySocketId", { enumerable: true, get: function () { return selectors_1.getParticipantBySocketId; } });
Object.defineProperty(exports, "getLiveSpeaker", { enumerable: true, get: function () { return selectors_1.getLiveSpeaker; } });
Object.defineProperty(exports, "getPointerTarget", { enumerable: true, get: function () { return selectors_1.getPointerTarget; } });
Object.defineProperty(exports, "getPointersToTarget", { enumerable: true, get: function () { return selectors_1.getPointersToTarget; } });
Object.defineProperty(exports, "getVoteCounts", { enumerable: true, get: function () { return selectors_1.getVoteCounts; } });
Object.defineProperty(exports, "evaluateConsensus", { enumerable: true, get: function () { return selectors_1.evaluateConsensus; } });
Object.defineProperty(exports, "hasConsensus", { enumerable: true, get: function () { return selectors_1.hasConsensus; } });
Object.defineProperty(exports, "isTimerExpired", { enumerable: true, get: function () { return selectors_1.isTimerExpired; } });
Object.defineProperty(exports, "getRemainingTime", { enumerable: true, get: function () { return selectors_1.getRemainingTime; } });
Object.defineProperty(exports, "isInGracePeriod", { enumerable: true, get: function () { return selectors_1.isInGracePeriod; } });
Object.defineProperty(exports, "shouldCleanup", { enumerable: true, get: function () { return selectors_1.shouldCleanup; } });
Object.defineProperty(exports, "isAvatarAvailable", { enumerable: true, get: function () { return selectors_1.isAvatarAvailable; } });
Object.defineProperty(exports, "getTakenAvatars", { enumerable: true, get: function () { return selectors_1.getTakenAvatars; } });
Object.defineProperty(exports, "serializeParticipants", { enumerable: true, get: function () { return selectors_1.serializeParticipants; } });
Object.defineProperty(exports, "serializePointerMap", { enumerable: true, get: function () { return selectors_1.serializePointerMap; } });
// ============================================================================
// ACTION TYPES
// ============================================================================
exports.ActionTypes = __importStar(require("./actions/actionTypes"));
// ============================================================================
// EFFECTS
// ============================================================================
var runEffects_1 = require("./effects/runEffects");
Object.defineProperty(exports, "runEffects", { enumerable: true, get: function () { return runEffects_1.runEffects; } });
// ============================================================================
// PHASE RULES
// ============================================================================
var phaseRules_1 = require("./reducer/phaseRules");
Object.defineProperty(exports, "canPerformAction", { enumerable: true, get: function () { return phaseRules_1.canPerformAction; } });

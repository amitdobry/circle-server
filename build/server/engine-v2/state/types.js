"use strict";
/**
 * Engine V2: State Types
 *
 * Core type definitions for the SoulCircle multiplayer state machine.
 * These types form the single source of truth for all session state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvariantViolation = void 0;
// ============================================================================
// INVARIANT VIOLATION ERROR
// ============================================================================
class InvariantViolation extends Error {
    constructor(message) {
        super(`[Invariant Violation] ${message}`);
        this.name = "InvariantViolation";
    }
}
exports.InvariantViolation = InvariantViolation;

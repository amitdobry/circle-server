"use strict";
/**
 * Engine V2: State Defaults
 *
 * Factory functions for creating initial state objects.
 * All state initialization must go through these functions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORPHAN_THRESHOLD_MS = exports.FORCE_CLEANUP_AFTER_MS = exports.SYNC_PAUSE_DURATION_MS = exports.GRACE_PERIOD_MS = exports.DEFAULT_SESSION_DURATION_MS = void 0;
exports.createInitialTableState = createInitialTableState;
exports.createParticipantState = createParticipantState;
exports.createInactiveTimer = createInactiveTimer;
exports.createContentPhaseState = createContentPhaseState;
exports.createRound = createRound;
exports.createActiveTimer = createActiveTimer;
const uuid_1 = require("uuid");
// ============================================================================
// TABLE STATE FACTORY
// ============================================================================
/**
 * Creates a new TableState for a room.
 * This is the only way to initialize a room's state.
 */
function createInitialTableState(roomId, tableId) {
    return {
        // Identity
        sessionId: (0, uuid_1.v4)(),
        roomId,
        tableId, // 🆕 Store table identity
        engineVersion: "v2",
        // Phase
        phase: "LOBBY",
        // Participants (empty Map)
        participants: new Map(),
        // Attention mechanism
        pointerMap: new Map(),
        liveSpeaker: null,
        syncPause: false,
        // Timer (inactive by default)
        timer: createInactiveTimer(),
        // 🆕 Round system (Content Phase Feature)
        currentRound: null,
        roundsHistory: [],
        contentPhase: null,
        // Lifecycle
        createdAt: Date.now(),
        lastUpdated: Date.now(),
    };
}
// ============================================================================
// PARTICIPANT STATE FACTORY
// ============================================================================
/**
 * Creates a new ParticipantState for a joining user.
 */
function createParticipantState(userId, displayName, avatarId, socketId = null) {
    return {
        // Identity
        userId,
        socketId,
        displayName,
        avatarId,
        // Role (default listener)
        role: "listener",
        // Presence (default connected if socketId provided)
        presence: socketId ? "CONNECTED" : "GHOST",
        // Attention
        attentionTarget: null,
        // Timestamps
        joinedAt: Date.now(),
        lastSeen: Date.now(),
    };
}
// ============================================================================
// TIMER FACTORY
// ============================================================================
/**
 * Creates an inactive timer state.
 */
function createInactiveTimer() {
    return {
        active: false,
        startTime: 0,
        durationMs: 0,
    };
}
// ============================================================================
// CONTENT PHASE & ROUND FACTORIES (🆕 Content Phase Feature)
// ============================================================================
/**
 * Creates a new ContentPhaseState for voting
 */
function createContentPhaseState(themeKey, targetRoundNumber) {
    return {
        status: "voting",
        tableThemeKey: themeKey,
        targetRoundNumber,
        votes: new Map(),
        selectedSubjectKey: null,
        selectedQuestionId: null,
        selectedQuestionText: null,
    };
}
/**
 * Creates a new RoundState
 */
function createRound(config) {
    return {
        roundId: (0, uuid_1.v4)(),
        roundNumber: config.roundNumber,
        status: "active",
        tableThemeKey: config.tableThemeKey,
        subjectKey: config.subjectKey,
        questionId: config.questionId,
        glyphText: config.glyphText,
        readyUserIds: new Set(),
        startedAt: Date.now(),
        endedAt: null,
    };
}
/**
 * Creates an active timer state.
 */
function createActiveTimer(durationMs) {
    const startTime = Date.now();
    return {
        active: true,
        startTime,
        durationMs,
        endTime: startTime + durationMs,
    };
}
// ============================================================================
// DEFAULT VALUES (Constants)
// ============================================================================
/**
 * Default session duration: 60 minutes
 */
exports.DEFAULT_SESSION_DURATION_MS = 60 * 60 * 1000;
/**
 * Grace period before room cleanup: 30 seconds
 */
exports.GRACE_PERIOD_MS = 30 * 1000;
/**
 * Sync pause duration: 2 seconds
 */
exports.SYNC_PAUSE_DURATION_MS = 2000;
/**
 * Force cleanup after 24 hours (memory leak safeguard)
 */
exports.FORCE_CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000;
/**
 * Orphan detection threshold: 10 minutes of inactivity
 */
exports.ORPHAN_THRESHOLD_MS = 10 * 60 * 1000;

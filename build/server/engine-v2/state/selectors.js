"use strict";
/**
 * Engine V2: Selectors
 *
 * Helper functions for querying TableState.
 * These are pure functions that do NOT mutate state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnectedParticipants = getConnectedParticipants;
exports.getGhostParticipants = getGhostParticipants;
exports.getParticipant = getParticipant;
exports.getParticipantBySocketId = getParticipantBySocketId;
exports.getLiveSpeaker = getLiveSpeaker;
exports.getPointerTarget = getPointerTarget;
exports.getPointersToTarget = getPointersToTarget;
exports.getVoteCounts = getVoteCounts;
exports.evaluateConsensus = evaluateConsensus;
exports.hasConsensus = hasConsensus;
exports.findParticipantByDisplayName = findParticipantByDisplayName;
exports.getConnectedParticipantIds = getConnectedParticipantIds;
exports.isTimerExpired = isTimerExpired;
exports.getRemainingTime = getRemainingTime;
exports.isInGracePeriod = isInGracePeriod;
exports.shouldCleanup = shouldCleanup;
exports.isAvatarAvailable = isAvatarAvailable;
exports.getTakenAvatars = getTakenAvatars;
exports.serializeParticipants = serializeParticipants;
exports.serializePointerMap = serializePointerMap;
// ============================================================================
// PARTICIPANT QUERIES
// ============================================================================
/**
 * Get all CONNECTED participants.
 */
function getConnectedParticipants(tableState) {
    return Array.from(tableState.participants.values()).filter((p) => p.presence === "CONNECTED");
}
/**
 * Get all GHOST participants.
 */
function getGhostParticipants(tableState) {
    return Array.from(tableState.participants.values()).filter((p) => p.presence === "GHOST");
}
/**
 * Get participant by userId.
 */
function getParticipant(tableState, userId) {
    return tableState.participants.get(userId);
}
/**
 * Get participant by socketId (for socket event handling).
 */
function getParticipantBySocketId(tableState, socketId) {
    for (const participant of tableState.participants.values()) {
        if (participant.socketId === socketId) {
            return participant;
        }
    }
    return undefined;
}
/**
 * Get the live speaker participant.
 */
function getLiveSpeaker(tableState) {
    if (!tableState.liveSpeaker)
        return null;
    return tableState.participants.get(tableState.liveSpeaker) || null;
}
// ============================================================================
// POINTER QUERIES
// ============================================================================
/**
 * Get who a user is pointing to.
 */
function getPointerTarget(tableState, userId) {
    return tableState.pointerMap.get(userId) || null;
}
/**
 * Get all users pointing to a specific target.
 */
function getPointersToTarget(tableState, targetUserId) {
    const pointers = [];
    for (const [pointerId, targetId] of tableState.pointerMap.entries()) {
        if (targetId === targetUserId) {
            pointers.push(pointerId);
        }
    }
    return pointers;
}
/**
 * Count votes for each candidate.
 * Only counts CONNECTED participants.
 */
function getVoteCounts(tableState) {
    const votes = new Map();
    const connected = getConnectedParticipants(tableState);
    console.log(`[getVoteCounts] 🗳️ Counting votes | Connected: ${connected.length}`);
    for (const participant of connected) {
        const target = tableState.pointerMap.get(participant.userId);
        const targetParticipant = target
            ? tableState.participants.get(target)
            : null;
        console.log(`[getVoteCounts]   ${participant.displayName} → ${targetParticipant?.displayName ?? "(no pointer)"}`);
        if (target) {
            votes.set(target, (votes.get(target) || 0) + 1);
        }
    }
    return votes;
}
// ============================================================================
// CONSENSUS QUERIES
// ============================================================================
/**
 * Evaluate consensus: all CONNECTED users point to the same target.
 * Returns the consensus candidate userId, or null if no consensus.
 */
function evaluateConsensus(tableState) {
    const connected = getConnectedParticipants(tableState);
    console.log(`[evaluateConsensus] 🔍 Evaluating in room ${tableState.roomId} | ` +
        `Connected: ${connected.length} | Phase: ${tableState.phase}`);
    // No connected users = no consensus
    if (connected.length === 0) {
        console.log(`[evaluateConsensus] ⚠️ No connected users`);
        return null;
    }
    const votes = getVoteCounts(tableState);
    // Log vote details
    const voteEntries = Array.from(votes.entries())
        .map(([userId, count]) => {
        const participant = tableState.participants.get(userId);
        return `${participant?.displayName ?? userId}: ${count} vote(s)`;
    })
        .join(", ");
    console.log(`[evaluateConsensus] 📊 Votes: ${voteEntries || "(no votes)"}`);
    // Find candidate with unanimous vote
    for (const [candidate, count] of votes.entries()) {
        if (count === connected.length) {
            const winner = tableState.participants.get(candidate);
            console.log(`[evaluateConsensus] ✅ CONSENSUS! ${winner?.displayName} (${count}/${connected.length})`);
            return candidate; // Unanimous
        }
    }
    console.log(`[evaluateConsensus] ❌ No consensus (need ${connected.length} votes)`);
    return null; // No consensus
}
/**
 * Check if consensus is currently achieved.
 */
function hasConsensus(tableState) {
    return evaluateConsensus(tableState) !== null;
}
// ============================================================================
// DISPLAY NAME RESOLUTION
// ============================================================================
/**
 * Find a participant by their display name.
 * V1 protocol sends display names; V2 uses userId as keys.
 * Returns undefined if not found.
 */
function findParticipantByDisplayName(tableState, displayName) {
    for (const participant of tableState.participants.values()) {
        if (participant.displayName === displayName) {
            return participant;
        }
    }
    return undefined;
}
/**
 * Get all connected participant userIds.
 */
function getConnectedParticipantIds(tableState) {
    return getConnectedParticipants(tableState).map((p) => p.userId);
}
// ============================================================================
// PHASE QUERIES
// ============================================================================
/**
 * Check if timer has expired.
 */
function isTimerExpired(tableState) {
    if (!tableState.timer.active)
        return false;
    if (!tableState.timer.endTime)
        return false;
    return Date.now() >= tableState.timer.endTime;
}
/**
 * Get remaining time in milliseconds.
 */
function getRemainingTime(tableState) {
    if (!tableState.timer.active || !tableState.timer.endTime)
        return 0;
    const remaining = tableState.timer.endTime - Date.now();
    return Math.max(0, remaining);
}
/**
 * Check if room is in grace period (ENDING phase).
 */
function isInGracePeriod(tableState) {
    return tableState.phase === "ENDING";
}
/**
 * Check if room should be cleaned up.
 */
function shouldCleanup(tableState) {
    // All participants left
    if (tableState.participants.size === 0)
        return true;
    // Phase is ENDED
    if (tableState.phase === "ENDED")
        return true;
    return false;
}
// ============================================================================
// AVATAR QUERIES
// ============================================================================
/**
 * Check if an avatar is available (not taken by CONNECTED or GHOST user).
 */
function isAvatarAvailable(tableState, avatarId) {
    for (const participant of tableState.participants.values()) {
        if (participant.avatarId === avatarId &&
            (participant.presence === "CONNECTED" || participant.presence === "GHOST")) {
            return false; // Avatar is taken
        }
    }
    return true; // Avatar is available
}
/**
 * Get all taken avatars.
 */
function getTakenAvatars(tableState) {
    const taken = new Set();
    for (const participant of tableState.participants.values()) {
        if (participant.presence === "CONNECTED" ||
            participant.presence === "GHOST") {
            taken.add(participant.avatarId);
        }
    }
    return Array.from(taken);
}
// ============================================================================
// SERIALIZATION HELPERS
// ============================================================================
/**
 * Serialize participants Map to array for network transmission.
 */
function serializeParticipants(tableState) {
    return Array.from(tableState.participants.values()).map((p) => ({
        userId: p.userId,
        socketId: p.socketId,
        displayName: p.displayName,
        avatarId: p.avatarId,
        role: p.role,
        presence: p.presence,
        attentionTarget: p.attentionTarget,
        joinedAt: p.joinedAt,
        lastSeen: p.lastSeen,
    }));
}
/**
 * Serialize pointerMap to object for network transmission.
 */
function serializePointerMap(tableState) {
    const obj = {};
    for (const [key, value] of tableState.pointerMap.entries()) {
        obj[key] = value;
    }
    return obj;
}

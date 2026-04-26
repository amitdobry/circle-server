"use strict";
/**
 * Round Lifecycle Logic
 *
 * Manages round state and readiness consensus.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.markUserReady = markUserReady;
exports.unmarkUserReady = unmarkUserReady;
exports.removeReadinessFromUser = removeReadinessFromUser;
exports.allUsersReady = allUsersReady;
exports.endRound = endRound;
exports.getReadinessSummary = getReadinessSummary;
/**
 * Mark user as ready for next question
 */
function markUserReady(round, userId) {
    if (round.readyUserIds.has(userId)) {
        console.log(`[Round] User ${userId} already marked ready`);
        return false; // Already ready
    }
    round.readyUserIds.add(userId);
    console.log(`[Round] User ${userId} marked ready (${round.readyUserIds.size} total)`);
    return true; // State changed
}
/**
 * Unmark user as ready
 */
function unmarkUserReady(round, userId) {
    if (!round.readyUserIds.has(userId)) {
        console.log(`[Round] User ${userId} was not ready`);
        return false; // Wasn't ready
    }
    round.readyUserIds.delete(userId);
    console.log(`[Round] User ${userId} unmarked ready (${round.readyUserIds.size} total)`);
    return true; // State changed
}
/**
 * Remove readiness from user (used on disconnect)
 * 🔥 CRITICAL: Must be called in handleDisconnect to prevent stuck rounds
 */
function removeReadinessFromUser(round, userId) {
    if (round.readyUserIds.has(userId)) {
        round.readyUserIds.delete(userId);
        console.log(`[Round] Removed readiness from disconnected user: ${userId}`);
    }
}
/**
 * Check if all active users are ready (unanimous consensus)
 */
function allUsersReady(round, participants) {
    const activeUserIds = Array.from(participants.values())
        .filter((p) => p.presence === "CONNECTED")
        .map((p) => p.userId);
    if (activeUserIds.length === 0)
        return false;
    // Check if every active user is in readyUserIds
    for (const userId of activeUserIds) {
        if (!round.readyUserIds.has(userId)) {
            return false;
        }
    }
    console.log(`[Round] All ${activeUserIds.length} users ready - consensus achieved!`);
    return true;
}
/**
 * End current round and prepare for history
 */
function endRound(round) {
    round.status = "ended";
    round.endedAt = Date.now();
    console.log(`[Round] Round ${round.roundNumber} ended`);
}
/**
 * Get readiness summary for UI
 */
function getReadinessSummary(round, participants) {
    const activeUserIds = Array.from(participants.values())
        .filter((p) => p.presence === "CONNECTED")
        .map((p) => p.userId);
    return {
        ready: round.readyUserIds.size,
        total: activeUserIds.length,
        readyUserIds: Array.from(round.readyUserIds),
    };
}

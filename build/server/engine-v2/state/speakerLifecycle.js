"use strict";
/**
 * Speaker lifecycle helpers for Engine V2
 *
 * Core principle: When the active speaker stops being valid for ANY reason,
 * the current speaking moment is INVALID and must end immediately.
 *
 * The natural fallback:
 * - liveSpeaker = null
 * - phase = ATTENTION_SELECTION
 * - pointerMap.clear()
 *
 * No syncPause. No role resets. Just return to attention selection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateSpeaker = invalidateSpeaker;
exports.isSpeaker = isSpeaker;
/**
 * Invalidate the current speaker and return to attention selection.
 *
 * Use this whenever the active speaker stops being valid:
 * - Speaker disconnects (becomes ghost)
 * - Speaker leaves
 * - Speaker is purged
 * - Speaker is kicked/removed by admin
 *
 * @param tableState - The room state
 * @param reason - Why the speaker is being invalidated (for logging)
 * @returns true if speaker was invalidated, false if no speaker was active
 */
function invalidateSpeaker(tableState, reason) {
    if (!tableState.liveSpeaker) {
        return false; // No active speaker, nothing to invalidate
    }
    const previousSpeaker = tableState.liveSpeaker;
    // Clear the speaking moment
    tableState.liveSpeaker = null;
    tableState.phase = "ATTENTION_SELECTION";
    tableState.pointerMap.clear();
    console.log(`[V2 Lifecycle] 🔇 Speaker invalidated (${reason}) | ${previousSpeaker} → ATTENTION_SELECTION`);
    return true;
}
/**
 * Check if a specific user is the current speaker.
 * Helper for deciding whether to call invalidateSpeaker().
 */
function isSpeaker(tableState, userId) {
    return tableState.liveSpeaker === userId;
}

"use strict";
/**
 * Engine V2: Speaker Manager
 *
 * Room-scoped speaker and attention state management.
 * Replaces global variables from legacy socketHandler.
 *
 * This enables multiple rooms to have different speakers simultaneously.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.speakerManager = void 0;
class SpeakerManager {
    constructor() {
        this.roomStates = new Map();
    }
    /**
     * Get or initialize room state
     */
    getOrCreateRoomState(roomId) {
        if (!this.roomStates.has(roomId)) {
            this.roomStates.set(roomId, {
                liveSpeaker: null,
                pointerMap: new Map(),
                syncPauseMode: false,
                lastSpeakerChange: Date.now(),
            });
        }
        return this.roomStates.get(roomId);
    }
    // ========================================
    // Live Speaker Management
    // ========================================
    getLiveSpeaker(roomId) {
        const state = this.getOrCreateRoomState(roomId);
        return state.liveSpeaker;
    }
    setLiveSpeaker(roomId, userId) {
        const state = this.getOrCreateRoomState(roomId);
        state.liveSpeaker = userId;
        state.lastSpeakerChange = Date.now();
        console.log(`[SpeakerManager] Room '${roomId}' speaker: ${userId || "none"}`);
    }
    clearLiveSpeaker(roomId) {
        this.setLiveSpeaker(roomId, null);
    }
    // ========================================
    // Pointer Map (Attention Mechanism)
    // ========================================
    getPointerMap(roomId) {
        const state = this.getOrCreateRoomState(roomId);
        return new Map(state.pointerMap); // Return copy
    }
    setPointer(roomId, fromUserId, toUserId) {
        const state = this.getOrCreateRoomState(roomId);
        state.pointerMap.set(fromUserId, toUserId);
    }
    clearPointer(roomId, fromUserId) {
        const state = this.getOrCreateRoomState(roomId);
        state.pointerMap.delete(fromUserId);
    }
    clearAllPointers(roomId) {
        const state = this.getOrCreateRoomState(roomId);
        state.pointerMap.clear();
    }
    // ========================================
    // Sync Pause Mode
    // ========================================
    getSyncPauseMode(roomId) {
        const state = this.getOrCreateRoomState(roomId);
        return state.syncPauseMode;
    }
    setSyncPauseMode(roomId, enabled) {
        const state = this.getOrCreateRoomState(roomId);
        state.syncPauseMode = enabled;
        console.log(`[SpeakerManager] Room '${roomId}' sync pause: ${enabled ? "ON" : "OFF"}`);
    }
    // ========================================
    // Consensus Detection
    // ========================================
    /**
     * Check if all participants are pointing to the same target
     */
    checkConsensus(roomId, participantIds) {
        const pointerMap = this.getPointerMap(roomId);
        if (participantIds.length === 0) {
            return { hasConsensus: false, target: null };
        }
        // Get first target
        const firstPointer = pointerMap.get(participantIds[0]);
        if (!firstPointer) {
            return { hasConsensus: false, target: null };
        }
        // Check if all point to same target
        const allPointToSame = participantIds.every((userId) => pointerMap.get(userId) === firstPointer);
        return {
            hasConsensus: allPointToSame,
            target: allPointToSame ? firstPointer : null,
        };
    }
    /**
     * Count how many users are pointing to a specific target
     */
    countPointersTo(roomId, targetUserId) {
        const pointerMap = this.getPointerMap(roomId);
        let count = 0;
        for (const target of pointerMap.values()) {
            if (target === targetUserId) {
                count++;
            }
        }
        return count;
    }
    // ========================================
    // Room Cleanup
    // ========================================
    destroyRoom(roomId) {
        this.roomStates.delete(roomId);
        console.log(`[SpeakerManager] Destroyed room state: ${roomId}`);
    }
    // ========================================
    // Debug / Inspection
    // ========================================
    getRoomState(roomId) {
        return this.roomStates.get(roomId);
    }
    listActiveRooms() {
        return Array.from(this.roomStates.keys());
    }
    getRoomCount() {
        return this.roomStates.size;
    }
    /**
     * Get detailed state for debugging
     */
    getDebugInfo(roomId) {
        const state = this.roomStates.get(roomId);
        if (!state) {
            return { exists: false };
        }
        return {
            exists: true,
            liveSpeaker: state.liveSpeaker,
            pointerCount: state.pointerMap.size,
            pointers: Array.from(state.pointerMap.entries()).map(([from, to]) => ({
                from,
                to,
            })),
            syncPauseMode: state.syncPauseMode,
            lastSpeakerChange: new Date(state.lastSpeakerChange).toISOString(),
        };
    }
}
// Singleton export
exports.speakerManager = new SpeakerManager();

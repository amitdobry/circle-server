/**
 * Engine V2: Speaker Manager
 *
 * Room-scoped speaker and attention state management.
 * Replaces global variables from legacy socketHandler.
 *
 * This enables multiple rooms to have different speakers simultaneously.
 */

interface RoomSpeakerState {
  liveSpeaker: string | null; // userId of current speaker
  pointerMap: Map<string, string>; // userId -> targetUserId
  syncPauseMode: boolean; // Is consensus lock active?
  lastSpeakerChange: number; // Timestamp of last change
}

class SpeakerManager {
  private roomStates = new Map<string, RoomSpeakerState>();

  /**
   * Get or initialize room state
   */
  private getOrCreateRoomState(roomId: string): RoomSpeakerState {
    if (!this.roomStates.has(roomId)) {
      this.roomStates.set(roomId, {
        liveSpeaker: null,
        pointerMap: new Map(),
        syncPauseMode: false,
        lastSpeakerChange: Date.now(),
      });
    }
    return this.roomStates.get(roomId)!;
  }

  // ========================================
  // Live Speaker Management
  // ========================================

  getLiveSpeaker(roomId: string): string | null {
    const state = this.getOrCreateRoomState(roomId);
    return state.liveSpeaker;
  }

  setLiveSpeaker(roomId: string, userId: string | null): void {
    const state = this.getOrCreateRoomState(roomId);
    state.liveSpeaker = userId;
    state.lastSpeakerChange = Date.now();

    console.log(
      `[SpeakerManager] Room '${roomId}' speaker: ${userId || "none"}`,
    );
  }

  clearLiveSpeaker(roomId: string): void {
    this.setLiveSpeaker(roomId, null);
  }

  // ========================================
  // Pointer Map (Attention Mechanism)
  // ========================================

  getPointerMap(roomId: string): Map<string, string> {
    const state = this.getOrCreateRoomState(roomId);
    return new Map(state.pointerMap); // Return copy
  }

  setPointer(roomId: string, fromUserId: string, toUserId: string): void {
    const state = this.getOrCreateRoomState(roomId);
    state.pointerMap.set(fromUserId, toUserId);
  }

  clearPointer(roomId: string, fromUserId: string): void {
    const state = this.getOrCreateRoomState(roomId);
    state.pointerMap.delete(fromUserId);
  }

  clearAllPointers(roomId: string): void {
    const state = this.getOrCreateRoomState(roomId);
    state.pointerMap.clear();
  }

  // ========================================
  // Sync Pause Mode
  // ========================================

  getSyncPauseMode(roomId: string): boolean {
    const state = this.getOrCreateRoomState(roomId);
    return state.syncPauseMode;
  }

  setSyncPauseMode(roomId: string, enabled: boolean): void {
    const state = this.getOrCreateRoomState(roomId);
    state.syncPauseMode = enabled;

    console.log(
      `[SpeakerManager] Room '${roomId}' sync pause: ${enabled ? "ON" : "OFF"}`,
    );
  }

  // ========================================
  // Consensus Detection
  // ========================================

  /**
   * Check if all participants are pointing to the same target
   */
  checkConsensus(
    roomId: string,
    participantIds: string[],
  ): {
    hasConsensus: boolean;
    target: string | null;
  } {
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
    const allPointToSame = participantIds.every(
      (userId) => pointerMap.get(userId) === firstPointer,
    );

    return {
      hasConsensus: allPointToSame,
      target: allPointToSame ? firstPointer : null,
    };
  }

  /**
   * Count how many users are pointing to a specific target
   */
  countPointersTo(roomId: string, targetUserId: string): number {
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

  destroyRoom(roomId: string): void {
    this.roomStates.delete(roomId);
    console.log(`[SpeakerManager] Destroyed room state: ${roomId}`);
  }

  // ========================================
  // Debug / Inspection
  // ========================================

  getRoomState(roomId: string): RoomSpeakerState | undefined {
    return this.roomStates.get(roomId);
  }

  listActiveRooms(): string[] {
    return Array.from(this.roomStates.keys());
  }

  getRoomCount(): number {
    return this.roomStates.size;
  }

  /**
   * Get detailed state for debugging
   */
  getDebugInfo(roomId: string): any {
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
export const speakerManager = new SpeakerManager();

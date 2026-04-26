/**
 * Engine V2: Room Registry
 *
 * Central registry for all active room states.
 * This is the ONLY place where TableState instances are stored.
 *
 * Map<roomId, TableState>
 */

import { TableState } from "../state/types";
import { createInitialTableState } from "../state/defaults";
import { isValidTableId } from "../../ui-config/tableDefinitions";

// ============================================================================
// ROOM REGISTRY (Singleton)
// ============================================================================

class RoomRegistry {
  private rooms: Map<string, TableState> = new Map();

  /**
   * Get a room's state by roomId.
   * Returns undefined if room doesn't exist.
   */
  getRoom(roomId: string): TableState | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Create a new room with initial state.
   * Throws if room already exists.
   *
   * 🆕 CRITICAL: Extracts tableId from roomId (format: "tableId" or "tableId-variant")
   */
  createRoom(roomId: string): TableState {
    if (this.rooms.has(roomId)) {
      throw new Error(`Room '${roomId}' already exists`);
    }

    // Extract tableId from roomId (e.g., "hearth" or "hearth-1" → "hearth")
    const tableId = roomId.split("-")[0];

    if (!isValidTableId(tableId)) {
      console.warn(
        `[RoomRegistry] ⚠️ Invalid tableId extracted from roomId: ${roomId} → ${tableId}, defaulting to 'hearth'`,
      );
      // For safety, default to hearth if invalid
      const tableState = createInitialTableState(roomId, "hearth");
      this.rooms.set(roomId, tableState);
      return tableState;
    }

    const tableState = createInitialTableState(roomId, tableId);
    this.rooms.set(roomId, tableState);

    console.log(
      `[RoomRegistry] Room '${roomId}' created for table '${tableId}'`,
    );
    return tableState;
  }

  /**
   * Get or create a room.
   * If room exists, return it. If not, create it.
   */
  getOrCreateRoom(roomId: string): TableState {
    const existing = this.rooms.get(roomId);
    if (existing) {
      console.log(
        `[RoomRegistry] ✅ Room '${roomId}' exists - ${existing.participants.size} participants`,
      );
      return existing;
    }

    console.log(`[RoomRegistry] 🆕 Creating new room '${roomId}'`);
    return this.createRoom(roomId);
  }

  /**
   * Destroy a room (cleanup).
   * Returns true if room was destroyed, false if it didn't exist.
   */
  destroyRoom(roomId: string): boolean {
    const existed = this.rooms.has(roomId);
    this.rooms.delete(roomId);

    if (existed) {
      console.log(`[RoomRegistry] Room '${roomId}' destroyed`);
    }

    return existed;
  }

  /**
   * List all active room IDs.
   */
  listRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Debug: Print full room state
   */
  debugPrintAllRooms(): void {
    console.log(`\n🗺️  [RoomRegistry] === FULL STATE DUMP ===`);
    console.log(`   Total rooms: ${this.rooms.size}`);
    for (const [roomId, room] of this.rooms.entries()) {
      console.log(`   📍 Room: ${roomId}`);
      console.log(`      - Participants: ${room.participants.size}`);
      for (const [userId, participant] of room.participants.entries()) {
        console.log(
          `        • ${participant.displayName} (${userId}) - ${participant.presence}`,
        );
      }
      console.log(`      - Phase: ${room.phase}`);
      console.log(`      - Session: ${room.sessionId || "none"}`);
    }
    console.log(`   ================================\n`);
  }

  /**
   * Get all rooms (for debugging/admin).
   */
  getAllRooms(): Map<string, TableState> {
    return new Map(this.rooms); // Return a copy
  }

  /**
   * Count active rooms.
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Check if a room exists.
   */
  hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  /**
   * Clear all rooms (for testing only).
   */
  clearAll(): void {
    const count = this.rooms.size;
    this.rooms.clear();
    console.log(`[RoomRegistry] Cleared ${count} rooms`);
  }

  /**
   * Find room by session ID
   */
  findRoomBySessionId(sessionId: string): TableState | null {
    for (const room of this.rooms.values()) {
      if (room.sessionId === sessionId) {
        return room;
      }
    }
    return null;
  }

  /**
   * Find which room a user is in (by socketId or userId)
   */
  findUserRoom(identifier: string): TableState | null {
    for (const room of this.rooms.values()) {
      // Check by userId (primary key)
      if (room.participants.has(identifier)) {
        return room;
      }

      // Check by socketId (secondary lookup)
      for (const participant of room.participants.values()) {
        if (participant.socketId === identifier) {
          return room;
        }
      }
    }
    return null;
  }

  /**
   * Get user's display name from any room (lookup helper)
   */
  getUserDisplayName(identifier: string): string | null {
    const room = this.findUserRoom(identifier);
    if (!room) return null;

    // Try userId first
    const byUserId = room.participants.get(identifier);
    if (byUserId) return byUserId.displayName;

    // Try socketId
    for (const participant of room.participants.values()) {
      if (participant.socketId === identifier) {
        return participant.displayName;
      }
    }

    return null;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global room registry instance.
 * This is the single source of truth for all room states.
 */
export const roomRegistry = new RoomRegistry();

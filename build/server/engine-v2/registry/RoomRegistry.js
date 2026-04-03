"use strict";
/**
 * Engine V2: Room Registry
 *
 * Central registry for all active room states.
 * This is the ONLY place where TableState instances are stored.
 *
 * Map<roomId, TableState>
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomRegistry = void 0;
const defaults_1 = require("../state/defaults");
// ============================================================================
// ROOM REGISTRY (Singleton)
// ============================================================================
class RoomRegistry {
    constructor() {
        this.rooms = new Map();
    }
    /**
     * Get a room's state by roomId.
     * Returns undefined if room doesn't exist.
     */
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    /**
     * Create a new room with initial state.
     * Throws if room already exists.
     */
    createRoom(roomId) {
        if (this.rooms.has(roomId)) {
            throw new Error(`Room '${roomId}' already exists`);
        }
        const tableState = (0, defaults_1.createInitialTableState)(roomId);
        this.rooms.set(roomId, tableState);
        console.log(`[RoomRegistry] Room '${roomId}' created`);
        return tableState;
    }
    /**
     * Get or create a room.
     * If room exists, return it. If not, create it.
     */
    getOrCreateRoom(roomId) {
        const existing = this.rooms.get(roomId);
        if (existing)
            return existing;
        return this.createRoom(roomId);
    }
    /**
     * Destroy a room (cleanup).
     * Returns true if room was destroyed, false if it didn't exist.
     */
    destroyRoom(roomId) {
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
    listRooms() {
        return Array.from(this.rooms.keys());
    }
    /**
     * Get all rooms (for debugging/admin).
     */
    getAllRooms() {
        return new Map(this.rooms); // Return a copy
    }
    /**
     * Count active rooms.
     */
    getRoomCount() {
        return this.rooms.size;
    }
    /**
     * Check if a room exists.
     */
    hasRoom(roomId) {
        return this.rooms.has(roomId);
    }
    /**
     * Clear all rooms (for testing only).
     */
    clearAll() {
        const count = this.rooms.size;
        this.rooms.clear();
        console.log(`[RoomRegistry] Cleared ${count} rooms`);
    }
    /**
     * Find room by session ID
     */
    findRoomBySessionId(sessionId) {
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
    findUserRoom(identifier) {
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
    getUserDisplayName(identifier) {
        const room = this.findUserRoom(identifier);
        if (!room)
            return null;
        // Try userId first
        const byUserId = room.participants.get(identifier);
        if (byUserId)
            return byUserId.displayName;
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
exports.roomRegistry = new RoomRegistry();

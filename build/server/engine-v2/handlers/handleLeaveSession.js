"use strict";
/**
 * Handle LEAVE_SESSION Action
 *
 * Encapsulates all business logic for when a user voluntarily leaves:
 * - Remove participant completely (not just ghost)
 * - If they were speaker, invalidate speaking moment
 * - Clear all pointers and emit events
 * - Rebuild panels
 *
 * ⚠️ TRANSITIONAL ARCHITECTURE:
 * - V2 TableState is the ONLY source of truth
 * - update-pointing events are TEMPORARY UI sync (to be removed)
 * - panelConfig snapshot is AUTHORITATIVE and must win on conflict
 * - V1 SpeakerManager is cache/adapter ONLY, never authoritative
 *
 * TODO: Migrate to snapshot-only model:
 * 1. Extend panelConfig payload to include pointer state
 * 2. Update client to consume pointers from panelConfig
 * 3. Remove update-pointing events from this handler
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
exports.handleLeaveSession = handleLeaveSession;
const selectors_1 = require("../state/selectors");
const participantLifecycle_1 = require("../state/participantLifecycle");
const contentPhaseLogic_1 = require("../content/contentPhaseLogic");
const roundLifecycle_1 = require("../round/roundLifecycle");
const ActionTypes = __importStar(require("../actions/actionTypes"));
function handleLeaveSession(tableState, userId, displayName) {
    const effects = [];
    // Find participant
    const leaver = (0, selectors_1.getParticipantBySocketId)(tableState, userId) ||
        (displayName
            ? (0, selectors_1.findParticipantByDisplayName)(tableState, displayName)
            : null);
    if (!leaver) {
        console.warn(`[handleLeaveSession] ⚠️ User ${userId} not found`);
        return [];
    }
    console.log(`[handleLeaveSession] 👋 ${leaver.displayName} leaving voluntarily...`);
    // ========================================================================
    // STEP 1: Collect pointers BEFORE removal for client clear events
    // ========================================================================
    const pointersToCleared = [];
    // Pointers FROM the leaver
    const leaverPointer = tableState.pointerMap.get(leaver.userId);
    if (leaverPointer) {
        const target = tableState.participants.get(leaverPointer);
        if (target) {
            pointersToCleared.push({
                from: leaver.displayName,
                to: target.displayName,
            });
        }
    }
    // Pointers TO the leaver
    for (const [fromUserId, toUserId] of tableState.pointerMap.entries()) {
        if (toUserId === leaver.userId) {
            const fromParticipant = tableState.participants.get(fromUserId);
            if (fromParticipant) {
                pointersToCleared.push({
                    from: fromParticipant.displayName,
                    to: leaver.displayName,
                });
            }
        }
    }
    // If leaver was speaker, collect ALL pointers (will be cleared by invalidateSpeaker)
    if (tableState.liveSpeaker === leaver.userId) {
        for (const [fromUserId, toUserId] of tableState.pointerMap.entries()) {
            const fromP = tableState.participants.get(fromUserId);
            const toP = tableState.participants.get(toUserId);
            if (fromP &&
                toP &&
                fromUserId !== leaver.userId &&
                toUserId !== leaver.userId) {
                // Don't duplicate pointers we already collected
                if (!pointersToCleared.some((p) => p.from === fromP.displayName && p.to === toP.displayName)) {
                    pointersToCleared.push({
                        from: fromP.displayName,
                        to: toP.displayName,
                    });
                }
            }
        }
    }
    // ========================================================================
    // STEP 1.5: Remove vote if leaving during content phase
    // Mirrors handleDisconnect — without this the phase deadlocks if the
    // remaining users have already voted but the leaver hadn't.
    // ========================================================================
    if (tableState.contentPhase && tableState.phase === "CONTENT_PHASE") {
        (0, contentPhaseLogic_1.removeVote)(tableState.contentPhase, leaver.userId);
        console.log(`[handleLeaveSession] 🗳️ Removed vote for ${leaver.displayName} (if any)`);
    }
    // ========================================================================
    // STEP 2: Remove participant (handles speaker invalidation internally)
    // ========================================================================
    const result = (0, participantLifecycle_1.removeParticipantSafely)(tableState, leaver.userId, "LEAVE");
    // ========================================================================
    // STEP 3: Emit pointer clear events for client UI
    // ⚠️ TRANSITIONAL: These are temporary UI sync events
    // TODO: Remove once client consumes pointer state from panelConfig snapshot
    // Panel snapshot (REBUILD_ALL_PANELS) is the authoritative source
    // ========================================================================
    for (const pointer of pointersToCleared) {
        effects.push({
            type: "SOCKET_EMIT_ROOM",
            roomId: tableState.roomId,
            event: "update-pointing",
            data: { from: pointer.from, to: null },
        });
    }
    // ========================================================================
    // STEP 4: Check if all remaining participants are ghosts
    // NOTE: connectedCount is intentionally calculated AFTER removeParticipantSafely
    // (Step 2) so it reflects the post-leave headcount, not the pre-leave snapshot.
    // ========================================================================
    const connectedCount = Array.from(tableState.participants.values()).filter((p) => p.presence === "CONNECTED").length;
    if (connectedCount === 0 && tableState.participants.size > 0) {
        tableState.phase = "ENDING";
        console.log(`[handleLeaveSession] ⚠️ All participants are ghosts → phase = ENDING`);
    }
    // ========================================================================
    // STEP 4.5: Remove round readiness if in an active round, then re-check
    // consensus. Mirrors handleDisconnect — without this, a leaver who was the
    // last "not ready" blocker deadlocks the round forever.
    // ========================================================================
    if (tableState.currentRound && tableState.currentRound.status === "active") {
        (0, roundLifecycle_1.removeReadinessFromUser)(tableState.currentRound, leaver.userId);
        console.log(`[handleLeaveSession] 🟢 Removed readiness for ${leaver.displayName} (if any)`);
        if (connectedCount < 2) {
            // A single user cannot achieve group consensus — abort round readiness
            // and route to waiting panel instead of advancing.
            console.log(`[handleLeaveSession] ⚠️ Only ${connectedCount} participant(s) remain — aborting round readiness, routing to waiting panel`);
            (0, roundLifecycle_1.endRound)(tableState.currentRound);
            tableState.roundsHistory.push(tableState.currentRound);
            tableState.currentRound = null;
            effects.push({ type: "EMIT_ROUND_STATE", roomId: tableState.roomId }, { type: "REBUILD_ALL_PANELS", roomId: tableState.roomId });
        }
        else {
            if ((0, roundLifecycle_1.allUsersReady)(tableState.currentRound, tableState.participants)) {
                console.log(`[handleLeaveSession] ✅ All remaining users ready after leave — triggering new round`);
                effects.push({
                    type: "DELAYED_ACTION",
                    roomId: tableState.roomId,
                    delayMs: 1500,
                    action: { type: ActionTypes.START_CONTENT_PHASE },
                });
            }
            effects.push({
                type: "EMIT_READINESS_UPDATE",
                roomId: tableState.roomId,
            });
        }
    }
    // ========================================================================
    // STEP 4.6: Re-check vote consensus after removal
    // The leaver may have been the last unvoted blocker — resolve if so.
    // ========================================================================
    if (tableState.contentPhase &&
        tableState.phase === "CONTENT_PHASE" &&
        connectedCount > 0) {
        if ((0, contentPhaseLogic_1.allUsersVoted)(tableState.contentPhase, tableState.participants)) {
            console.log(`[handleLeaveSession] ✅ All remaining users voted after leave — resolving content phase`);
            effects.push({
                type: "DELAYED_ACTION",
                roomId: tableState.roomId,
                delayMs: 1000,
                action: { type: ActionTypes.RESOLVE_CONTENT_PHASE },
            });
        }
    }
    console.log(`[handleLeaveSession] ✅ ${leaver.displayName} left | Remaining: ${tableState.participants.size}`);
    // ========================================================================
    // STEP 5: Return effects
    // ========================================================================
    effects.push({
        type: "SYSTEM_LOG",
        roomId: tableState.roomId,
        message: `${leaver.displayName} left the circle`,
        level: "info",
    }, {
        type: "REBUILD_ALL_PANELS",
        roomId: tableState.roomId,
    });
    return effects;
}

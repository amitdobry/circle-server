"use strict";
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
exports.handleConcentNewSpeakerFromMicDropped = handleConcentNewSpeakerFromMicDropped;
const panelConfigService_1 = require("../../panelConfigService");
const socketHandler_1 = require("../../socketHandler");
const dispatch_1 = require("../../engine-v2/reducer/dispatch");
const ActionTypes = __importStar(require("../../engine-v2/actions/actionTypes"));
function handleConcentNewSpeakerFromMicDropped(payload, context) {
    const { name } = payload;
    const { users, pointerMap, io, logAction, logSystem } = context;
    if (!name) {
        logSystem("🚨 Missing name in handleConcentNewSpeakerFromMicDropped payload.");
        return;
    }
    let speakerCandidate = null;
    let socketIdOfResponder = null;
    // 🧠 Find responder socket ID and the first "wantsToPickUpTheMic" user
    for (const [socketId, user] of users.entries()) {
        logSystem(`🔍 SCAN [${socketId}] ${user.name} → state: ${user.state}`);
        if (user.name === name) {
            socketIdOfResponder = socketId;
        }
        if (!speakerCandidate && user.state === "wantsToPickUpTheMic") {
            speakerCandidate = user.name;
        }
    }
    if (!speakerCandidate || !socketIdOfResponder) {
        logSystem("🚨 Could not find speakerCandidate or responder.");
        return;
    }
    // 👆 Set pointer and update state
    (0, socketHandler_1.setPointer)(name, speakerCandidate);
    io.emit("update-pointing", { from: name, to: speakerCandidate });
    const responder = users.get(socketIdOfResponder);
    if (responder) {
        responder.state = "waitingForOthersAfterMicDropAndConcentNewSpeaker";
        users.set(socketIdOfResponder, responder);
    }
    logAction(`👂 ${name} gave consent for ${speakerCandidate} to pick up the mic`);
    // Check if all consenting users have now given consent.
    // Responder state was updated above — if nobody is left in
    // appendingConcentToPickUpTheMic, we have full consensus.
    const remainingConsenters = Array.from(users.values()).filter((u) => u.state === "appendingConcentToPickUpTheMic").length;
    if (remainingConsenters === 0) {
        // 🎉 Consensus complete — new speaker goes LIVE
        // Reset V1 user states before panel rebuild
        for (const [sid, user] of users.entries()) {
            user.state = user.name === speakerCandidate ? "speaking" : "regular";
            users.set(sid, user);
        }
        // Sync V1 globals so panelBuilderRouter routes correctly
        (0, socketHandler_1.setLiveSpeaker)(speakerCandidate);
        (0, socketHandler_1.setIsSyncPauseMode)(false);
        // Sync V2 via ACCEPT_MIC → fires REBUILD_ALL_PANELS which emits panels to everyone
        const speakerSocketId = Array.from(users.entries()).find(([, u]) => u.name === speakerCandidate)?.[0] ?? null;
        try {
            (0, dispatch_1.dispatchAndRun)("default-room", speakerSocketId, { type: ActionTypes.ACCEPT_MIC, payload: {} }, io);
        }
        catch (err) {
            logSystem(`🚨 V2 ACCEPT_MIC dispatch failed: ${err}`);
            // Fallback: emit panels via V1
            for (const [socketId, user] of users.entries()) {
                const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
                io.to(socketId).emit("receive:panelConfig", config);
            }
        }
    }
    else {
        // Not yet consensus — emit intermediate panels via V1
        for (const [socketId, user] of users.entries()) {
            logAction(`📦 Preparing panel for ${user.name} → ${user.state}`);
            const config = (0, panelConfigService_1.getPanelConfigFor)(user.name);
            io.to(socketId).emit("receive:panelConfig", config);
        }
    }
}

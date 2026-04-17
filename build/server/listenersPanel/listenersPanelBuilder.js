"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildListenerSyncPanel = buildListenerSyncPanel;
const listenerCatalog_1 = require("../ui-config/listenerCatalog");
const gesture_service_1 = require("../ui-config/gesture.service");
function buildListenerSyncPanel(ctx) {
    const currentUser = Array.from(ctx.allUsers.values()).find((u) => u.name === ctx.userName);
    let stateKey = "state-1";
    switch (currentUser?.state) {
        case "hasClickedMouth":
            stateKey = "state-4";
            break;
        case "hasClickedBrain":
            stateKey = "state-3";
            break;
        case "hasClickedEar":
            stateKey = "state-2";
            break;
        case "waiting":
            stateKey = "state-5";
            break;
        case "micIsDropped":
            stateKey = "state-6";
            break;
        case "appendingConcentToPickUpTheMic":
            stateKey = "state-7";
            break;
        case "wantsToPickUpTheMic":
            stateKey = "state-8";
            break;
        case "doesNotWantToPickUpTheMic":
            stateKey = "state-9";
            break;
        case "waitingForOthersAfterMicDropAndConcentNewSpeaker":
            stateKey = "state-10";
            break;
        case "hasDroppedTheMic":
            stateKey = "state-11";
            break;
        case "micPassInProcess":
            stateKey = "state-12";
            break;
        case "isChoosingUserToPassMic":
            stateKey = "state-13";
            break;
        case "micOfferReceivedFromPassTheMic":
            stateKey = "state-14";
            break;
        case "hasOfferedMicToUserFromPassTheMic":
            stateKey = "state-15";
            break;
        case "awaitingUserMicOfferResolutionFromPassTheMic":
            stateKey = "state-16";
            break;
        case "waitingOnPickerOfBlueSpeaker":
            stateKey = "state-17"; // <-- NEW
            break;
        case "isPickingBlueSpeaker":
            stateKey = "state-18"; // <-- NEW
            break;
        case "isPickingEarBluePerson":
            stateKey = "state-19";
            break;
    }
    // ——————————————————————————————————————
    // 📦 Step 2: Load the panel config
    // ——————————————————————————————————————
    const panel = listenerCatalog_1.listenerCatalog[stateKey];
    console.log("[Server] Sending attention panel config:", JSON.stringify(stateKey, null, 2));
    const config = panel.getConfig();
    // ——————————————————————————————————————
    // 🧩 Step 3: Enrich config with dynamic context
    // ——————————————————————————————————————
    // 🎯 Speaker label in top bar
    const speakerName = ctx.liveSpeaker || "Nobody";
    config.forEach((block) => {
        if (block.id === "listener-top-bar") {
            block.blocks.forEach((b) => {
                if (b.id === "listening-to-text") {
                    b.content = `Listening to - ${speakerName}`;
                }
            });
        }
    });
    // 🎯 Dynamic gesture sub-buttons (Ear group only)
    if (stateKey === "state-2") {
        const earGestures = (0, gesture_service_1.getAllGestureButtons)().ear;
        const gesturePanelBlocks = earGestures
            .filter((gesture) => gesture.actionType === "syncedGesture") // blue gestures are handled by static config
            .map((gesture, idx) => ({
            id: `ear-${gesture.subType}-${idx}`,
            type: "button",
            buttonClass: gesture.tailwind,
            content: gesture.label, // optional
            button: {
                label: gesture.label,
                type: "semiListenerAction", // or "listenerAction"
                actionType: gesture.actionType ?? "selectEar",
                group: "ear",
                icon: gesture.emoji,
                code: gesture.subType,
                control: gesture,
                targetUser: undefined,
            },
        }));
        config.forEach((block) => {
            if (block.id === "ear-sub-gesture-buttons") {
                // Preserve any listenerControl (blue) buttons already in the config
                const blueBlocks = block.blocks.filter((b) => b.type === "button" && "button" in b && b.button?.type === "listenerControl");
                block.blocks = [...gesturePanelBlocks, ...blueBlocks];
            }
        });
    }
    // 🧠 Interrupter injection (state-5)
    if (stateKey === "state-5") {
        const interrupter = Array.from(ctx.allUsers.values()).find((u) => u.state === "hasClickedMouth" || u.state === "hasClickedBrain");
        const name = interrupter?.name || "someone";
        config.forEach((block) => {
            if (block.id === "listener-waiting-panel") {
                block.blocks.forEach((b) => {
                    if (b.id === "listener-waiting-text") {
                        b.content = `🧠 ${name} is having a moment of thought — perhaps an epiphany?`;
                    }
                });
            }
        });
    }
    // 🎤 Mic drop panel (state-6)
    if (stateKey === "state-6") {
        const dropper = Array.from(ctx.allUsers.values()).find((u) => u.state === "hasDroppedTheMic");
        const name = dropper?.name || "Someone";
        config.forEach((block) => {
            if (block.id === "listener-mic-drop-text") {
                block.blocks.forEach((b) => {
                    if (b.id === "mic-drop-message") {
                        b.content = `🎤 ${name} dropped the mic. Will you pick it up?`;
                    }
                });
            }
        });
    }
    // ✋ Consensus prompt panel (state-7)
    if (stateKey === "state-7") {
        const candidate = Array.from(ctx.allUsers.values()).find((u) => u.state === "wantsToPickUpTheMic");
        const name = candidate?.name || "Someone";
        config.forEach((block) => {
            if (block.id === "mic-consent-text") {
                block.blocks.forEach((b) => {
                    if (b.id === "mic-consent-message") {
                        b.content = `🎤 ${name} wants to pick up the mic. Listen to ${name}?`;
                    }
                });
            }
            if (block.id === "mic-consent-buttons") {
                block.blocks.forEach((b) => {
                    if (b.id === "agree-btn" && b.type === "button" && "button" in b) {
                        b.button.targetUser = name;
                    }
                });
            }
        });
    }
    if (stateKey === "state-8") {
        config.forEach((block) => {
            if (block.id === "waiting-to-become-speaker") {
                block.blocks.forEach((b) => {
                    if (b.id === "speaker-candidate-waiting-text") {
                        b.content = `⏳ You’ve requested to speak. Waiting for the group to sync with you...`;
                    }
                });
            }
        });
    }
    if (stateKey === "state-10") {
        const candidate = Array.from(ctx.allUsers.values()).find((u) => u.state === "wantsToPickUpTheMic");
        const name = candidate?.name || "Someone";
        config.forEach((block) => {
            if (block.id === "Concent-mic-drop-pickup") {
                block.blocks.forEach((b) => {
                    if (b.id === "speaker-candidate-waiting-text") {
                        b.content = `⏳ You’ve gave concent for ${name} to speak. Waiting for the group to sync with you...`;
                    }
                });
            }
        });
    }
    // 👤 Dynamic participant buttons (state-13)
    if (stateKey === "state-13") {
        const currentUserName = ctx.userName;
        const otherUsers = Array.from(ctx.allUsers.values())
            .filter((u) => u.name !== currentUserName)
            .map((user, index) => ({
            id: `choose-${user.name.toLowerCase()}-btn`,
            type: "button",
            buttonClass: "px-5 py-3 rounded-full text-sm font-semibold border transition-all duration-200 bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:shadow-md hover:scale-105",
            button: {
                label: user.name,
                type: "listenerControl",
                actionType: "offerMicToUserFromPassTheMic",
                targetUser: user.name,
                group: "mic",
            },
        }));
        config.forEach((block) => {
            if (block.id === "choose-user-button-panel") {
                block.blocks = otherUsers;
            }
        });
    }
    // 🗣️ Mic offer received — inject speaker name into prompt
    if (stateKey === "state-14") {
        const speaker = Array.from(ctx.allUsers.values()).find((u) => u.state === "hasOfferedMicToUserFromPassTheMic");
        const speakerName = speaker?.name || "Someone";
        config.forEach((block) => {
            if (block.id === "mic-offer-received") {
                block.blocks.forEach((b) => {
                    if (b.id === "mic-offer-text") {
                        b.content = `🎤 ${speakerName} wants to pass you the mic. Will you speak?`;
                    }
                });
            }
        });
    }
    if (stateKey === "state-15") {
        const targetUser = Array.from(ctx.allUsers.values()).find((u) => u.state === "micOfferReceivedFromPassTheMic");
        const targetName = targetUser?.name || "someone";
        config.forEach((block) => {
            if (block.id === "waiting-for-mic-acceptance") {
                block.blocks.forEach((b) => {
                    if (b.id === "waiting-text") {
                        b.content = `⏳ Waiting for ${targetName} to decide whether to accept the mic...`;
                    }
                });
            }
        });
    }
    if (stateKey === "state-16") {
        const speaker = Array.from(ctx.allUsers.values()).find((u) => u.state === "hasOfferedMicToUserFromPassTheMic");
        const target = Array.from(ctx.allUsers.values()).find((u) => u.state === "micOfferReceivedFromPassTheMic");
        const speakerName = speaker?.name || "someone";
        const targetName = target?.name || "someone";
        config.forEach((block) => {
            if (block.id === "others-await-offer-result") {
                block.blocks.forEach((b) => {
                    if (b.id === "watching-offer-text") {
                        b.content = `🎤 ${speakerName} has offered the mic to ${targetName}, who is deciding whether to speak.`;
                    }
                });
            }
        });
    }
    // state-17: show who is picking
    if (stateKey === "state-17") {
        const picker = Array.from(ctx.allUsers.values()).find((u) => u.state === "isPickingBlueSpeaker");
        const byName = picker?.name ?? "Someone";
        config.forEach((block) => {
            if (block.id === "listener-waiting-panel") {
                block.blocks.forEach((b) => {
                    if (b.id === "listener-waiting-text") {
                        b.content = `🟦 ${byName} is choosing who to offer the mic to…`;
                    }
                });
            }
        });
    }
    // state-18: initiator picker (Blue)
    if (stateKey === "state-18") {
        const currentUserName = ctx.userName;
        // find current speaker by ctx.liveSpeaker (or by user.state === "speaking")
        const currentSpeakerName = ctx.liveSpeaker ||
            Array.from(ctx.allUsers.values()).find((u) => u.state === "speaking")
                ?.name ||
            "";
        const candidates = Array.from(ctx.allUsers.values())
            .filter((u) => u.name !== currentUserName && u.name !== currentSpeakerName)
            .map((user) => ({
            id: `choose-${user.name.toLowerCase()}-btn`,
            type: "button",
            buttonClass: "px-5 py-3 rounded-full text-sm font-semibold border transition-all duration-200 bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:shadow-md hover:scale-105",
            button: {
                label: user.name,
                type: "listenerControl",
                group: "blue",
                actionType: "bluePersonChosen",
                targetUser: user.name,
            },
        }));
        config.forEach((block) => {
            if (block.id === "choose-user-button-panel") {
                block.blocks = candidates;
            }
        });
    }
    // state-19: ear-blue picker (private — only the initiating listener sees this)
    if (stateKey === "state-19") {
        const candidates = Array.from(ctx.allUsers.values())
            .filter((u) => u.name !== ctx.userName)
            .map((user) => ({
            id: `ear-blue-pick-${user.name.toLowerCase()}-btn`,
            type: "button",
            buttonClass: "px-5 py-3 rounded-full text-sm font-semibold border transition-all duration-200 bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 hover:shadow-md hover:scale-105",
            button: {
                label: user.name,
                type: "listenerControl",
                group: "blue",
                actionType: "earBluePersonChosen",
                targetUser: user.name,
            },
        }));
        config.forEach((block) => {
            if (block.id === "ear-blue-choose-button-panel") {
                block.blocks = candidates;
            }
        });
    }
    return config;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.panelBuilderRouter = panelBuilderRouter;
const attentionPanelBuilder_1 = require("./attentionPanel/attentionPanelBuilder");
const listenersPanelBuilder_1 = require("./listenersPanel/listenersPanelBuilder");
const speakerPanelBuilder_1 = require("./speakerPanel/speakerPanelBuilder");
function panelBuilderRouter(ctx) {
    if (!ctx.userIsParticipant) {
        return (0, attentionPanelBuilder_1.buildAttentionPanel)(ctx); //this is just for now
    }
    if (ctx.liveSpeaker || ctx.isSyncPauseMode) {
        if (ctx.isUserSpeaker) {
            return (0, speakerPanelBuilder_1.buildSpeakerPanel)(ctx);
        }
        else {
            return (0, listenersPanelBuilder_1.buildListenerSyncPanel)(ctx);
        }
    }
    else {
        return (0, attentionPanelBuilder_1.buildAttentionPanel)(ctx);
    }
}

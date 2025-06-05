import { buildAttentionPanel } from "./attentionPanel/attentionPanelBuilder";
import { buildListenerSyncPanel } from "./listenersPanel/listenersPanelBuilder";
import { PanelContext } from "./panelConfigService";
import { buildSpeakerPanel } from "./speakerPanel/speakerPanelBuilder";
import { PanelConfig } from "./types/blockTypes";

export function panelBuilderRouter(ctx: PanelContext): PanelConfig {
  if (!ctx.userIsParticipant) {
    return buildAttentionPanel(ctx); //this is just for now
  }
  if (ctx.liveSpeaker || ctx.isSyncPauseMode) {
    if (ctx.isUserSpeaker) {
      return buildSpeakerPanel(ctx);
    } else {
      return buildListenerSyncPanel(ctx);
    }
  } else {
    return buildAttentionPanel(ctx);
  }
}

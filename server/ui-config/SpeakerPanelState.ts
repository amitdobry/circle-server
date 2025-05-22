// server/ui-config/SpeakerPanelState.ts

import { PanelConfig } from "../types/blockTypes";

export class SpeakerPanelState {
  key: string;
  label: string;
  panelConfig: PanelConfig;

  constructor(key: string, label: string, panelConfig: PanelConfig) {
    this.key = key;
    this.label = label;
    this.panelConfig = panelConfig;
  }

  getConfig(): PanelConfig {
    return this.panelConfig;
  }
}

import { PanelContext } from "../panelConfigService";
import { listenerCatalog } from "../ui-config/listenerCatalog";

export function buildListenerSyncPanel(ctx: PanelContext) {
  const currentUser = Array.from(ctx.allUsers.values()).find(
    (u) => u.name === ctx.userName
  );

  // ——————————————————————————————————————
  // 🧠 Step 1: Determine the panel state key
  // ——————————————————————————————————————

  type ListenerStateKey = keyof typeof listenerCatalog;
  let stateKey: ListenerStateKey = "state-1";

  switch (currentUser?.state) {
    case "hasClickedMouth":
      stateKey = "state-4";
      break;
    case "hasClickedBrain":
      stateKey = "state-3";
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
  }

  // ——————————————————————————————————————
  // 📦 Step 2: Load the panel config
  // ——————————————————————————————————————

  const panel = listenerCatalog[stateKey];
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

  // 🧠 Interrupter injection (state-5)
  if (stateKey === "state-5") {
    const interrupter = Array.from(ctx.allUsers.values()).find(
      (u) => u.state === "hasClickedMouth" || u.state === "hasClickedBrain"
    );
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
    const dropper = Array.from(ctx.allUsers.values()).find(
      (u) => u.state === "hasDroppedTheMic"
    );
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
    const candidate = Array.from(ctx.allUsers.values()).find(
      (u) => u.state === "wantsToPickUpTheMic"
    );
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

  return config;
}

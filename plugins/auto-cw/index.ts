/**
 * Auto Content Warning Plugin
 *
 * A sample plugin that automatically adds content warnings to notes
 * containing specific keywords. Demonstrates the "before" event system
 * which allows plugins to modify data before it's processed.
 *
 * Configuration:
 * - keywords: Array of keywords that trigger auto-CW
 * - cwText: The content warning text to add
 * - enabled: Whether the plugin is active
 *
 * @example
 * // Configure via API: POST /api/x/auto-cw/config
 * {
 *   "keywords": ["spoiler", "nsfw", "sensitive"],
 *   "cwText": "Auto-CW: May contain sensitive content",
 *   "enabled": true
 * }
 */

import type { RoxPlugin, PluginContext } from "../../packages/backend/src/plugins/types/plugin";

interface AutoCWConfig {
  keywords: string[];
  cwText: string;
  enabled: boolean;
}

const DEFAULT_CONFIG: AutoCWConfig = {
  keywords: [],
  cwText: "Content Warning",
  enabled: true,
};

const autoCWPlugin: RoxPlugin = {
  id: "auto-cw",
  name: "Auto Content Warning",
  version: "1.0.0",
  description: "Automatically adds content warnings based on configurable keywords",

  async onLoad({ events, logger, config }: PluginContext) {
    logger.info("Auto CW plugin loaded");

    // Initialize default config if not set
    const existingConfig = await config.getAll();
    if (Object.keys(existingConfig).length === 0) {
      await config.set("keywords", DEFAULT_CONFIG.keywords);
      await config.set("cwText", DEFAULT_CONFIG.cwText);
      await config.set("enabled", DEFAULT_CONFIG.enabled);
      logger.info("Initialized default configuration");
    }

    // Subscribe to note creation (before event - can modify)
    events.onBefore("note:beforeCreate", async (data) => {
      const enabled = (await config.get<boolean>("enabled")) ?? true;
      if (!enabled) {
        return {};
      }

      const keywords = (await config.get<string[]>("keywords")) ?? [];
      if (keywords.length === 0) {
        return {};
      }

      const content = data.content.toLowerCase();
      const hasKeyword = keywords.some((keyword) =>
        content.includes(keyword.toLowerCase()),
      );

      if (hasKeyword && !data.cw) {
        const cwText =
          (await config.get<string>("cwText")) ?? DEFAULT_CONFIG.cwText;

        logger.info(
          { userId: data.userId, matchedKeywords: keywords.filter((k) => content.includes(k.toLowerCase())) },
          "Auto-CW applied to note",
        );

        return {
          modified: {
            ...data,
            cw: cwText,
          },
        };
      }

      return {};
    });
  },

  onUnload() {
    console.log("Auto CW plugin unloaded");
  },

  routes(app) {
    // Get current configuration
    app.get("/config", async (c) => {
      // Note: In a real plugin, you'd get config from context
      // This is a simplified example
      return c.json({
        message: "Configuration endpoint",
        note: "Use POST to update configuration",
      });
    });

    // Get plugin status
    app.get("/status", (c) => {
      return c.json({
        plugin: "auto-cw",
        status: "active",
        version: "1.0.0",
      });
    });
  },
};

export default autoCWPlugin;

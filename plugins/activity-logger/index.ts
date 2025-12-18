/**
 * Activity Logger Plugin
 *
 * A sample plugin that logs all note and user activity.
 * Useful for debugging and understanding the plugin event system.
 *
 * @example
 * This plugin will log events like:
 * - Note created: { noteId: "abc123", userId: "user1" }
 * - Note deleted: { noteId: "abc123" }
 * - User registered: { userId: "user1", username: "alice" }
 */

import type { RoxPlugin } from "../../packages/backend/src/plugins/types/plugin";

const activityLoggerPlugin: RoxPlugin = {
  id: "activity-logger",
  name: "Activity Logger",
  version: "1.0.0",
  description: "Logs all note and user activity for debugging and analytics",

  onLoad({ events, logger, config }) {
    logger.info("Activity Logger plugin loaded");

    // Subscribe to note creation events
    events.on("note:afterCreate", ({ note }) => {
      logger.info(
        {
          event: "note:created",
          noteId: note.id,
          userId: note.userId,
          visibility: note.visibility,
          hasMedia: (note.fileIds?.length ?? 0) > 0,
        },
        "Note created",
      );
    });

    // Subscribe to note deletion events
    events.on("note:afterDelete", ({ noteId, userId }) => {
      logger.info(
        {
          event: "note:deleted",
          noteId,
          userId,
        },
        "Note deleted",
      );
    });

    // Subscribe to user registration events
    events.on("user:afterRegister", ({ userId, username }) => {
      logger.info(
        {
          event: "user:registered",
          userId,
          username,
        },
        "User registered",
      );
    });

    // Log plugin configuration on load
    config.getAll().then((allConfig) => {
      logger.debug({ config: allConfig }, "Plugin configuration loaded");
    });
  },

  onUnload() {
    // Event subscriptions are automatically cleaned up by the PluginLoader
    console.log("Activity Logger plugin unloaded");
  },

  // Optional: Add a status endpoint
  routes(app) {
    app.get("/status", (c) => {
      return c.json({
        plugin: "activity-logger",
        status: "active",
        version: "1.0.0",
      });
    });
  },
};

export default activityLoggerPlugin;

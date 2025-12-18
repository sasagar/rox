/**
 * Activity Logger Frontend Plugin
 *
 * A sample frontend plugin that displays activity statistics
 * in the admin dashboard. Demonstrates how to use plugin slots
 * and fetch data from plugin API endpoints.
 *
 * @example
 * // Register the plugin
 * import activityLoggerFrontend from './plugins/activity-logger/frontend';
 * pluginRegistry.register(activityLoggerFrontend);
 */

import type { FrontendPlugin, AdminSlotProps } from "../../packages/frontend/src/lib/plugins/types";

/**
 * Activity Stats Dashboard Widget
 * Displays in the admin:dashboard slot
 */
function ActivityStatsDashboard({ pluginId }: AdminSlotProps) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
        Activity Logger
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Plugin ID: {pluginId}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 rounded-md bg-blue-50 dark:bg-blue-900/20">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            --
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Notes Today
          </div>
        </div>
        <div className="text-center p-3 rounded-md bg-green-50 dark:bg-green-900/20">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            --
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            New Users
          </div>
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
        View logs in server console or /api/x/activity-logger/status
      </p>
    </div>
  );
}

/**
 * Activity Logger Frontend Plugin Definition
 */
const activityLoggerFrontend: FrontendPlugin = {
  id: "activity-logger",
  name: "Activity Logger",
  version: "1.0.0",
  description: "Displays activity statistics in the admin dashboard",

  slots: {
    "admin:dashboard": ActivityStatsDashboard,
  },

  onLoad() {
    console.log("[activity-logger] Frontend plugin loaded");
  },

  onUnload() {
    console.log("[activity-logger] Frontend plugin unloaded");
  },
};

export default activityLoggerFrontend;

/**
 * Auto Content Warning Frontend Plugin
 *
 * A sample frontend plugin that adds UI elements for the auto-CW feature.
 * Demonstrates:
 * - Settings tab for configuring keywords
 * - Note footer indicator when auto-CW was applied
 *
 * @example
 * // Register the plugin
 * import autoCWFrontend from './plugins/auto-cw/frontend';
 * pluginRegistry.register(autoCWFrontend);
 */

import { useState } from "react";
import type {
  FrontendPlugin,
  NoteSlotProps,
  SettingsSlotProps,
} from "../../packages/frontend/src/lib/plugins/types";

/**
 * Auto-CW Indicator
 * Shows in note:footer when a note has an auto-applied CW
 * (This is a demonstration - actual detection would require backend data)
 */
function AutoCWIndicator({ pluginId: _pluginId }: NoteSlotProps) {
  // In a real implementation, this would check if the note's CW was auto-applied
  // For demo purposes, we just show a subtle indicator
  return null; // Only render when applicable
}

/**
 * Auto-CW Settings Panel
 * Displays in settings:tabs for user configuration
 */
function AutoCWSettings({ pluginId }: SettingsSlotProps) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [cwText, setCwText] = useState("Content Warning");
  const [enabled, setEnabled] = useState(true);

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Auto Content Warning Settings
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure automatic content warnings for notes containing specific keywords.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Plugin ID: {pluginId}
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">
            Enable Auto-CW
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Automatically add CW to notes with matching keywords
          </div>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${enabled ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-600"}
          `}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${enabled ? "translate-x-6" : "translate-x-1"}
            `}
          />
        </button>
      </div>

      {/* CW Text */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Content Warning Text
        </label>
        <input
          type="text"
          value={cwText}
          onChange={(e) => setCwText(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          placeholder="Content Warning"
        />
      </div>

      {/* Keywords */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Trigger Keywords
        </label>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword();
              }
            }}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="Enter keyword..."
          />
          <button
            onClick={addKeyword}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {keywords.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No keywords configured. Add keywords that should trigger auto-CW.
            </p>
          ) : (
            keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-sm"
              >
                {keyword}
                <button
                  onClick={() => removeKeyword(keyword)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  aria-label={`Remove keyword: ${keyword}`}
                >
                  &times;
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Save Button (Demo) */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => {
            console.log("[auto-cw] Settings saved:", { enabled, cwText, keywords });
            alert("Settings saved! (This is a demo - actual save would require backend API)");
          }}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Save Settings
        </button>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          Note: This is a demo. Actual settings are managed via the backend API.
        </p>
      </div>
    </div>
  );
}

/**
 * Auto-CW Frontend Plugin Definition
 */
const autoCWFrontend: FrontendPlugin = {
  id: "auto-cw",
  name: "Auto Content Warning",
  version: "1.0.0",
  description: "UI for configuring automatic content warnings",

  slots: {
    "note:footer": AutoCWIndicator,
    "settings:tabs": AutoCWSettings,
  },

  onLoad() {
    console.log("[auto-cw] Frontend plugin loaded");
  },

  onUnload() {
    console.log("[auto-cw] Frontend plugin unloaded");
  },
};

export default autoCWFrontend;

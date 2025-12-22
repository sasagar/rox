#!/usr/bin/env bun
/**
 * Plugin CLI
 *
 * Command-line interface for managing Rox plugins.
 *
 * Usage:
 *   bun run plugin install <git-url>    Install plugin from Git URL
 *   bun run plugin install <path>       Install plugin from local path
 *   bun run plugin uninstall <id>       Uninstall a plugin
 *   bun run plugin list                 List installed plugins
 *   bun run plugin enable <id>          Enable a plugin
 *   bun run plugin disable <id>         Disable a plugin
 *   bun run plugin info <id>            Show plugin details
 */

import { PluginManager } from "./PluginManager.js";
import type { PluginSource } from "shared";

const PLUGIN_DIR = process.env.PLUGIN_DIRECTORY || "./plugins";

/**
 * Parse command line arguments
 */
function parseArgs(): { command: string; args: string[]; flags: Record<string, boolean | string> } {
  const args = process.argv.slice(2);
  const command = args[0] || "help";
  const flags: Record<string, boolean | string> = {};
  const positional: string[] = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      if (key) {
        flags[key] = value ?? true;
      }
    } else if (arg.startsWith("-")) {
      flags[arg.slice(1)] = true;
    } else {
      positional.push(arg);
    }
  }

  return { command, args: positional, flags };
}

/**
 * Print colored text
 */
function color(text: string, code: number): string {
  return `\x1b[${code}m${text}\x1b[0m`;
}

const colors = {
  green: (text: string) => color(text, 32),
  red: (text: string) => color(text, 31),
  yellow: (text: string) => color(text, 33),
  blue: (text: string) => color(text, 34),
  gray: (text: string) => color(text, 90),
  bold: (text: string) => color(text, 1),
};

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
${colors.bold("Rox Plugin Manager")}

${colors.bold("Usage:")}
  bun run plugin <command> [options]

${colors.bold("Commands:")}
  install <source>     Install a plugin from Git URL or local path
  uninstall <id>       Uninstall a plugin by ID
  list                 List all installed plugins
  enable <id>          Enable a disabled plugin
  disable <id>         Disable a plugin
  info <id>            Show detailed plugin information

${colors.bold("Options:")}
  --force              Force installation even if plugin exists
  --no-enable          Don't enable plugin after installation
  --keep-files         Keep plugin files when uninstalling
  --help, -h           Show this help message

${colors.bold("Examples:")}
  ${colors.gray("# Install from GitHub")}
  bun run plugin install https://github.com/user/my-rox-plugin

  ${colors.gray("# Install from local path")}
  bun run plugin install ./my-plugin

  ${colors.gray("# Force reinstall")}
  bun run plugin install https://github.com/user/plugin --force

  ${colors.gray("# List installed plugins")}
  bun run plugin list
`);
}

/**
 * Install command
 */
async function installCommand(
  manager: PluginManager,
  source: string,
  flags: Record<string, boolean | string>
): Promise<void> {
  if (!source) {
    console.error(colors.red("Error: Source is required"));
    console.log("Usage: bun run plugin install <git-url|path>");
    process.exit(1);
  }

  console.log(colors.blue(`Installing plugin from: ${source}`));

  let pluginSource: PluginSource;

  // Determine source type
  if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("git@")) {
    pluginSource = { type: "git", url: source };
  } else if (source.includes("/") || source.startsWith(".")) {
    pluginSource = { type: "local", path: source };
  } else {
    // Assume registry name (future feature)
    pluginSource = { type: "registry", name: source };
  }

  const result = await manager.install(pluginSource, {
    force: flags.force === true,
    enable: flags["no-enable"] !== true,
  });

  if (result.success) {
    console.log(colors.green(`✓ Successfully installed ${result.pluginId} v${result.version}`));
    if (result.warnings && result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.log(colors.yellow(`  Warning: ${warning}`));
      }
    }
  } else {
    console.error(colors.red(`✗ Installation failed: ${result.error}`));
    process.exit(1);
  }
}

/**
 * Uninstall command
 */
async function uninstallCommand(
  manager: PluginManager,
  pluginId: string,
  flags: Record<string, boolean | string>
): Promise<void> {
  if (!pluginId) {
    console.error(colors.red("Error: Plugin ID is required"));
    console.log("Usage: bun run plugin uninstall <plugin-id>");
    process.exit(1);
  }

  console.log(colors.blue(`Uninstalling plugin: ${pluginId}`));

  const success = await manager.uninstall(pluginId, {
    keepFiles: flags["keep-files"] === true,
  });

  if (success) {
    console.log(colors.green(`✓ Successfully uninstalled ${pluginId}`));
  } else {
    console.error(colors.red(`✗ Failed to uninstall ${pluginId}`));
    process.exit(1);
  }
}

/**
 * List command
 */
function listCommand(manager: PluginManager): void {
  const plugins = manager.list();

  if (plugins.length === 0) {
    console.log(colors.gray("No plugins installed."));
    console.log(colors.gray("Install one with: bun run plugin install <git-url>"));
    return;
  }

  console.log(colors.bold("\nInstalled Plugins:\n"));

  for (const plugin of plugins) {
    const status = plugin.enabled
      ? colors.green("●")
      : colors.gray("○");

    const types: string[] = [];
    if (plugin.hasBackend) types.push("backend");
    if (plugin.hasFrontend) types.push("frontend");

    console.log(`${status} ${colors.bold(plugin.name)} ${colors.gray(`(${plugin.id})`)} v${plugin.version}`);
    if (plugin.description) {
      console.log(`  ${colors.gray(plugin.description)}`);
    }
    console.log(`  ${colors.gray(`Types: ${types.join(", ") || "none"}`)}`);
    console.log();
  }

  console.log(colors.gray(`Total: ${plugins.length} plugin(s)`));
}

/**
 * Enable command
 */
function enableCommand(manager: PluginManager, pluginId: string): void {
  if (!pluginId) {
    console.error(colors.red("Error: Plugin ID is required"));
    process.exit(1);
  }

  if (manager.enable(pluginId)) {
    console.log(colors.green(`✓ Enabled ${pluginId}`));
  } else {
    console.error(colors.red(`✗ Plugin not found: ${pluginId}`));
    process.exit(1);
  }
}

/**
 * Disable command
 */
function disableCommand(manager: PluginManager, pluginId: string): void {
  if (!pluginId) {
    console.error(colors.red("Error: Plugin ID is required"));
    process.exit(1);
  }

  if (manager.disable(pluginId)) {
    console.log(colors.green(`✓ Disabled ${pluginId}`));
  } else {
    console.error(colors.red(`✗ Plugin not found: ${pluginId}`));
    process.exit(1);
  }
}

/**
 * Info command
 */
function infoCommand(manager: PluginManager, pluginId: string): void {
  if (!pluginId) {
    console.error(colors.red("Error: Plugin ID is required"));
    process.exit(1);
  }

  const plugin = manager.getPlugin(pluginId);

  if (!plugin) {
    console.error(colors.red(`Plugin not found: ${pluginId}`));
    process.exit(1);
  }

  console.log(`
${colors.bold(plugin.name)} ${colors.gray(`v${plugin.version}`)}

${colors.bold("ID:")}          ${plugin.id}
${colors.bold("Status:")}      ${plugin.enabled ? colors.green("Enabled") : colors.gray("Disabled")}
${colors.bold("Description:")} ${plugin.description || colors.gray("No description")}
${colors.bold("Author:")}      ${plugin.author || colors.gray("Unknown")}
${colors.bold("License:")}     ${plugin.license || colors.gray("Not specified")}
${colors.bold("Source:")}      ${plugin.source}
${colors.bold("Installed:")}   ${new Date(plugin.installedAt).toLocaleString()}

${colors.bold("Entry Points:")}
  Backend:  ${plugin.backend || colors.gray("None")}
  Frontend: ${plugin.frontend || colors.gray("None")}

${colors.bold("Permissions:")} ${plugin.permissions?.join(", ") || colors.gray("None required")}
${colors.bold("Dependencies:")} ${plugin.dependencies?.join(", ") || colors.gray("None")}
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { command, args, flags } = parseArgs();

  // Initialize plugin directory
  PluginManager.initPluginDirectory(PLUGIN_DIR);

  const manager = new PluginManager(PLUGIN_DIR);

  if (flags.help || flags.h) {
    printHelp();
    return;
  }

  switch (command) {
    case "install":
    case "i":
      await installCommand(manager, args[0] ?? "", flags);
      break;

    case "uninstall":
    case "remove":
    case "rm":
      await uninstallCommand(manager, args[0] ?? "", flags);
      break;

    case "list":
    case "ls":
      listCommand(manager);
      break;

    case "enable":
      enableCommand(manager, args[0] ?? "");
      break;

    case "disable":
      disableCommand(manager, args[0] ?? "");
      break;

    case "info":
    case "show":
      infoCommand(manager, args[0] ?? "");
      break;

    case "help":
    default:
      printHelp();
      break;
  }
}

main().catch((error) => {
  console.error(colors.red(`Error: ${error.message}`));
  process.exit(1);
});

#!/usr/bin/env bun
/**
 * Database Restore Script
 *
 * Restores a database from a backup file.
 * Supports PostgreSQL with psql.
 *
 * Usage:
 *   bun run scripts/restore.ts <backup-file>
 *
 * Environment Variables:
 *   DB_TYPE       - Database type (postgres)
 *   DATABASE_URL  - Database connection string
 *
 * Examples:
 *   # Restore from backup file
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." bun run scripts/restore.ts backup.sql
 *
 * WARNING: This will overwrite existing data in the target database!
 */

import { $, which } from "bun";
import { existsSync } from "fs";
import { join } from "path";
import * as readline from "readline";

/**
 * Common PostgreSQL installation paths
 */
const PG_PATHS = [
  "/opt/homebrew/opt/postgresql@16/bin",
  "/opt/homebrew/opt/postgresql@15/bin",
  "/opt/homebrew/opt/postgresql@14/bin",
  "/opt/homebrew/bin",
  "/usr/local/opt/postgresql@16/bin",
  "/usr/local/opt/postgresql@15/bin",
  "/usr/local/opt/postgresql@14/bin",
  "/usr/local/bin",
  "/usr/bin",
];

/**
 * Find PostgreSQL tool (pg_dump, psql, etc.)
 * Returns null if not found locally
 */
function findPgTool(name: string): string | null {
  // First check if it's in PATH
  const inPath = which(name);
  if (inPath) {
    return inPath;
  }

  // Search common installation paths
  for (const dir of PG_PATHS) {
    const fullPath = join(dir, name);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Find PostgreSQL Docker container
 */
async function findPostgresContainer(): Promise<string | null> {
  try {
    const result = await $`docker ps --format "{{.Names}}" --filter "ancestor=postgres"`.text();
    const containers = result.trim().split("\n").filter(Boolean);
    if (containers.length > 0) {
      return containers[0] ?? null;
    }

    // Also check for containers with postgres in the name
    const result2 = await $`docker ps --format "{{.Names}}"`.text();
    const allContainers = result2.trim().split("\n").filter(Boolean);
    const postgresContainer = allContainers.find(
      (name) => name.toLowerCase().includes("postgres") || name.toLowerCase().includes("postgresql"),
    );
    return postgresContainer ?? null;
  } catch {
    return null;
  }
}

interface DatabaseConfig {
  type: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

/**
 * Parse DATABASE_URL into components
 */
function parseDatabaseUrl(url: string): DatabaseConfig {
  const dbType = process.env.DB_TYPE || "postgres";

  const urlObj = new URL(url);

  return {
    type: dbType,
    host: urlObj.hostname,
    port: urlObj.port || "5432",
    database: urlObj.pathname.slice(1),
    username: urlObj.username,
    password: urlObj.password,
  };
}

/**
 * Prompt user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
  // Skip confirmation if --yes flag is provided
  if (process.argv.includes("--yes") || process.argv.includes("-y")) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Restore PostgreSQL database
 */
async function restorePostgres(config: DatabaseConfig, inputFile: string): Promise<void> {
  console.log(`📦 Restoring PostgreSQL database: ${config.database}`);
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   From: ${inputFile}`);

  // Try to find psql locally first
  const psql = findPgTool("psql");

  if (psql) {
    // Use local psql
    console.log(`   Using: ${psql}`);

    const env = {
      ...process.env,
      PGPASSWORD: config.password,
    };

    try {
      await $`${psql} \
        -h ${config.host} \
        -p ${config.port} \
        -U ${config.username} \
        -d ${config.database} \
        -f ${inputFile}`.env(env).quiet();
    } catch (error) {
      console.error(`❌ Restore failed:`, error);
      process.exit(1);
    }
  } else {
    // Try Docker container
    const container = await findPostgresContainer();
    if (!container) {
      console.error("❌ psql not found locally and no PostgreSQL Docker container found.");
      console.error("");
      console.error("Please either:");
      console.error("  1. Install PostgreSQL client tools:");
      console.error("     macOS: brew install postgresql@16");
      console.error("     Linux: apt install postgresql-client");
      console.error("");
      console.error("  2. Or ensure a PostgreSQL Docker container is running");
      process.exit(1);
    }

    console.log(`   Using Docker container: ${container}`);

    try {
      // Read backup file content
      const backupContent = await Bun.file(inputFile).text();

      // For Docker, we need to handle host differently
      const dockerHost = config.host === "localhost" || config.host === "127.0.0.1" ? "localhost" : config.host;

      // Pipe backup content to psql in container
      await $`echo ${backupContent} | docker exec -i \
        -e PGPASSWORD=${config.password} \
        ${container} \
        psql \
        -h ${dockerHost} \
        -p ${config.port} \
        -U ${config.username} \
        -d ${config.database}`.quiet();
    } catch (error) {
      console.error(`❌ Restore failed:`, error);
      process.exit(1);
    }
  }

  console.log(`✅ Restore completed successfully!`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log("═".repeat(50));
  console.log("🦊 Rox Database Restore");
  console.log("═".repeat(50));

  // Check environment variables
  const databaseUrl = process.env.DATABASE_URL;
  const dbType = process.env.DB_TYPE || "postgres";

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    console.error("");
    console.error("Usage:");
    console.error(
      '  DB_TYPE=postgres DATABASE_URL="postgresql://user:pass@host:5432/db" bun run scripts/restore.ts backup.sql',
    );
    process.exit(1);
  }

  // Check input file argument
  const inputArg = process.argv.find((arg) => !arg.startsWith("-") && arg !== process.argv[0] && arg !== process.argv[1]);

  if (!inputArg) {
    console.error("❌ Backup file path is required");
    console.error("");
    console.error("Usage:");
    console.error(
      '  DB_TYPE=postgres DATABASE_URL="postgresql://..." bun run scripts/restore.ts backup.sql',
    );
    process.exit(1);
  }

  // Resolve input file path
  const inputFile = inputArg.startsWith("/") ? inputArg : join(process.cwd(), inputArg);

  if (!existsSync(inputFile)) {
    console.error(`❌ Backup file not found: ${inputFile}`);
    process.exit(1);
  }

  // Parse database URL
  const config = parseDatabaseUrl(databaseUrl);

  console.log("");

  // Show file info
  const file = Bun.file(inputFile);
  const size = file.size;
  const sizeStr =
    size > 1024 * 1024
      ? `${(size / 1024 / 1024).toFixed(2)} MB`
      : `${(size / 1024).toFixed(2)} KB`;
  console.log(`📄 Backup file: ${inputFile}`);
  console.log(`   Size: ${sizeStr}`);
  console.log("");

  // Confirm before proceeding
  console.log("⚠️  WARNING: This will overwrite existing data in the target database!");
  console.log(`   Target: ${config.database} @ ${config.host}:${config.port}`);
  console.log("");

  const confirmed = await confirm("Are you sure you want to proceed?");
  if (!confirmed) {
    console.log("❌ Restore cancelled");
    process.exit(0);
  }

  console.log("");

  // Run restore based on database type
  switch (dbType) {
    case "postgres":
      await restorePostgres(config, inputFile);
      break;
    default:
      console.error(`❌ Unsupported database type: ${dbType}`);
      console.error("   Supported types: postgres");
      process.exit(1);
  }

  console.log("");
  console.log("═".repeat(50));
  console.log("");
  console.log("💡 Tip: You may need to run migrations after restore:");
  console.log("   bun run db:migrate");
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});

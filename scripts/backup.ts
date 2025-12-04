#!/usr/bin/env bun
/**
 * Database Backup Script
 *
 * Creates a backup of the database for migration or disaster recovery.
 * Supports PostgreSQL with pg_dump.
 *
 * Usage:
 *   bun run scripts/backup.ts [output-file]
 *
 * Environment Variables:
 *   DB_TYPE       - Database type (postgres)
 *   DATABASE_URL  - Database connection string
 *
 * Examples:
 *   # Backup to timestamped file
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." bun run scripts/backup.ts
 *
 *   # Backup to specific file
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." bun run scripts/backup.ts backup.sql
 */

import { $, which } from "bun";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const ROOT_DIR = join(import.meta.dir, "..");

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

  // Handle different URL formats
  // postgresql://user:pass@host:port/database
  // postgres://user:pass@host:port/database
  const urlObj = new URL(url);

  return {
    type: dbType,
    host: urlObj.hostname,
    port: urlObj.port || "5432",
    database: urlObj.pathname.slice(1), // Remove leading /
    username: urlObj.username,
    password: urlObj.password,
  };
}

/**
 * Generate backup filename with timestamp
 */
function generateBackupFilename(dbType: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `backup-${dbType}-${timestamp}.sql`;
}

/**
 * Backup PostgreSQL database
 */
async function backupPostgres(config: DatabaseConfig, outputFile: string): Promise<void> {
  console.log(`📦 Backing up PostgreSQL database: ${config.database}`);
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   Output: ${outputFile}`);

  // Ensure output directory exists
  const outputDir = dirname(outputFile);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Try to find pg_dump locally first
  const pgDump = findPgTool("pg_dump");

  if (pgDump) {
    // Use local pg_dump
    console.log(`   Using: ${pgDump}`);

    const env = {
      ...process.env,
      PGPASSWORD: config.password,
    };

    try {
      await $`${pgDump} \
        -h ${config.host} \
        -p ${config.port} \
        -U ${config.username} \
        -d ${config.database} \
        --format=plain \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        -f ${outputFile}`.env(env);
    } catch (error) {
      console.error(`❌ Backup failed:`, error);
      process.exit(1);
    }
  } else {
    // Try Docker container
    const container = await findPostgresContainer();
    if (!container) {
      console.error("❌ pg_dump not found locally and no PostgreSQL Docker container found.");
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
      // For Docker, we need to handle host differently
      // If host is localhost, use the container's internal connection
      const dockerHost = config.host === "localhost" || config.host === "127.0.0.1" ? "localhost" : config.host;

      const result = await $`docker exec \
        -e PGPASSWORD=${config.password} \
        ${container} \
        pg_dump \
        -h ${dockerHost} \
        -p ${config.port} \
        -U ${config.username} \
        -d ${config.database} \
        --format=plain \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists`.text();

      await Bun.write(outputFile, result);
    } catch (error) {
      console.error(`❌ Backup failed:`, error);
      process.exit(1);
    }
  }

  console.log(`✅ Backup completed successfully!`);

  // Show file size
  const file = Bun.file(outputFile);
  const size = file.size;
  const sizeStr =
    size > 1024 * 1024
      ? `${(size / 1024 / 1024).toFixed(2)} MB`
      : `${(size / 1024).toFixed(2)} KB`;
  console.log(`   File size: ${sizeStr}`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log("═".repeat(50));
  console.log("🦊 Rox Database Backup");
  console.log("═".repeat(50));

  // Check environment variables
  const databaseUrl = process.env.DATABASE_URL;
  const dbType = process.env.DB_TYPE || "postgres";

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    console.error("");
    console.error("Usage:");
    console.error(
      '  DB_TYPE=postgres DATABASE_URL="postgresql://user:pass@host:5432/db" bun run scripts/backup.ts',
    );
    process.exit(1);
  }

  // Parse database URL
  const config = parseDatabaseUrl(databaseUrl);

  // Determine output file
  const outputArg = process.argv[2];
  const backupsDir = join(ROOT_DIR, "backups");
  const outputFile = outputArg
    ? outputArg.startsWith("/")
      ? outputArg
      : join(process.cwd(), outputArg)
    : join(backupsDir, generateBackupFilename(dbType));

  console.log("");

  // Run backup based on database type
  switch (dbType) {
    case "postgres":
      await backupPostgres(config, outputFile);
      break;
    default:
      console.error(`❌ Unsupported database type: ${dbType}`);
      console.error("   Supported types: postgres");
      process.exit(1);
  }

  console.log("");
  console.log("═".repeat(50));
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});

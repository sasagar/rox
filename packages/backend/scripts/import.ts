#!/usr/bin/env bun
/**
 * Database Import Script (Drizzle ORM)
 *
 * Imports database contents from a JSON export file.
 * This allows migration between different database types (PostgreSQL, SQLite/D1, MySQL)
 *
 * Usage:
 *   bun run packages/backend/scripts/import.ts <input-file>
 *
 * Environment Variables:
 *   DB_TYPE       - Database type (postgres, sqlite, mysql)
 *   DATABASE_URL  - Database connection string
 *
 * Examples:
 *   # Import from JSON file to PostgreSQL
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." bun run packages/backend/scripts/import.ts export.json
 *
 *   # Import to SQLite/D1
 *   DB_TYPE=sqlite DATABASE_URL="sqlite://./rox.db" bun run packages/backend/scripts/import.ts export.json
 *
 * WARNING: This will overwrite existing data in the target database!
 */

import { existsSync } from "fs";
import { join } from "path";
import { sql } from "drizzle-orm";
import * as readline from "readline";
import { createDatabase, type Database } from "../src/db/index.js";
import * as pgSchema from "../src/db/schema/pg.js";

const dbType = process.env.DB_TYPE || "postgres";

/**
 * Supported export version
 */
const SUPPORTED_VERSION = 1;

/**
 * Tables to import in dependency order
 * Maps table name to schema object
 */
const IMPORT_TABLES: Array<{ name: string; schema: any; snakeCaseName: string }> = [
  { name: "users", schema: pgSchema.users, snakeCaseName: "users" },
  { name: "sessions", schema: pgSchema.sessions, snakeCaseName: "sessions" },
  { name: "passkeyCredentials", schema: pgSchema.passkeyCredentials, snakeCaseName: "passkey_credentials" },
  { name: "passkeyChallenges", schema: pgSchema.passkeyChallenges, snakeCaseName: "passkey_challenges" },
  { name: "roles", schema: pgSchema.roles, snakeCaseName: "roles" },
  { name: "roleAssignments", schema: pgSchema.roleAssignments, snakeCaseName: "role_assignments" },
  { name: "driveFolders", schema: pgSchema.driveFolders, snakeCaseName: "drive_folders" },
  { name: "driveFiles", schema: pgSchema.driveFiles, snakeCaseName: "drive_files" },
  { name: "notes", schema: pgSchema.notes, snakeCaseName: "notes" },
  { name: "reactions", schema: pgSchema.reactions, snakeCaseName: "reactions" },
  { name: "follows", schema: pgSchema.follows, snakeCaseName: "follows" },
  { name: "receivedActivities", schema: pgSchema.receivedActivities, snakeCaseName: "received_activities" },
  { name: "instanceBlocks", schema: pgSchema.instanceBlocks, snakeCaseName: "instance_blocks" },
  { name: "invitationCodes", schema: pgSchema.invitationCodes, snakeCaseName: "invitation_codes" },
  { name: "instanceSettings", schema: pgSchema.instanceSettings, snakeCaseName: "instance_settings" },
  { name: "userReports", schema: pgSchema.userReports, snakeCaseName: "user_reports" },
  { name: "moderationAuditLogs", schema: pgSchema.moderationAuditLogs, snakeCaseName: "moderation_audit_logs" },
  { name: "userWarnings", schema: pgSchema.userWarnings, snakeCaseName: "user_warnings" },
  { name: "customEmojis", schema: pgSchema.customEmojis, snakeCaseName: "custom_emojis" },
  { name: "notifications", schema: pgSchema.notifications, snakeCaseName: "notifications" },
  { name: "pushSubscriptions", schema: pgSchema.pushSubscriptions, snakeCaseName: "push_subscriptions" },
  { name: "remoteInstances", schema: pgSchema.remoteInstances, snakeCaseName: "remote_instances" },
  { name: "scheduledNotes", schema: pgSchema.scheduledNotes, snakeCaseName: "scheduled_notes" },
];

/**
 * Tables to clear in reverse dependency order
 */
const CLEAR_ORDER = [...IMPORT_TABLES].reverse();

/**
 * Export data structure
 */
interface ExportData {
  version: number;
  exportedAt: string;
  dbType: string;
  tables: Record<string, unknown[]>;
  metadata: {
    totalRecords: number;
    tableRecordCounts: Record<string, number>;
  };
}

/**
 * Prompt user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
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
 * Convert date strings back to Date objects
 */
function convertDates(record: Record<string, unknown>): Record<string, unknown> {
  const result = { ...record };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      result[key] = new Date(value);
    }
  }
  return result;
}

/**
 * Import data into database using Drizzle
 */
async function importToDatabase(
  db: Database,
  data: ExportData,
  clearExisting: boolean,
): Promise<void> {
  // Clear existing data if requested
  if (clearExisting) {
    console.log("");
    console.log("🗑️  Clearing existing data...");
    for (const { name, snakeCaseName } of CLEAR_ORDER) {
      try {
        // Use raw SQL to truncate with CASCADE (PostgreSQL)
        if (dbType === "postgres") {
          await db.execute(sql.raw(`TRUNCATE TABLE "${snakeCaseName}" CASCADE`));
        } else {
          // For SQLite/MySQL, delete all rows
          await db.execute(sql.raw(`DELETE FROM "${snakeCaseName}"`));
        }
        console.log(`   Cleared ${name}`);
      } catch {
        console.log(`   Skipped ${name} (may not exist)`);
      }
    }
  }

  console.log("");
  console.log("📥 Importing data...");

  for (const { name, schema, snakeCaseName } of IMPORT_TABLES) {
    // Try both camelCase (new format) and snake_case (old format) keys
    const records = data.tables[name] || data.tables[snakeCaseName];
    if (!records || records.length === 0) {
      console.log(`   ${name}: 0 records (skipped)`);
      continue;
    }

    try {
      // Convert date strings back to Date objects
      const convertedRecords = records.map((record) =>
        convertDates(record as Record<string, unknown>),
      );

      // Insert in batches to avoid memory issues
      const batchSize = 100;
      let imported = 0;

      for (let i = 0; i < convertedRecords.length; i += batchSize) {
        const batch = convertedRecords.slice(i, i + batchSize);
        // @ts-expect-error - Dynamic table access
        await db.insert(schema).values(batch).onConflictDoNothing();
        imported += batch.length;
      }

      console.log(`   ${name}: ${imported} records imported`);
    } catch (error) {
      console.error(`   Error importing ${name}:`, error);
    }
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log("═".repeat(50));
  console.log("🦊 Rox Database Import (Drizzle)");
  console.log("═".repeat(50));

  // Check environment variables
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    console.error("");
    console.error("Usage:");
    console.error(
      '  DB_TYPE=postgres DATABASE_URL="postgresql://user:pass@host:5432/db" bun run packages/backend/scripts/import.ts export.json',
    );
    process.exit(1);
  }

  // Check input file argument
  const inputArg = process.argv.find(
    (arg) => !arg.startsWith("-") && arg !== process.argv[0] && arg !== process.argv[1],
  );

  if (!inputArg) {
    console.error("❌ Input file path is required");
    console.error("");
    console.error("Usage:");
    console.error(
      '  DB_TYPE=postgres DATABASE_URL="postgresql://..." bun run packages/backend/scripts/import.ts export.json',
    );
    process.exit(1);
  }

  // Resolve input file path
  const inputFile = inputArg.startsWith("/") ? inputArg : join(process.cwd(), inputArg);

  if (!existsSync(inputFile)) {
    console.error(`❌ Input file not found: ${inputFile}`);
    process.exit(1);
  }

  // Read and parse export file
  console.log("");
  console.log(`📄 Reading export file: ${inputFile}`);

  const fileContent = await Bun.file(inputFile).text();
  let exportData: ExportData;

  try {
    exportData = JSON.parse(fileContent);
  } catch {
    console.error("❌ Failed to parse export file as JSON");
    process.exit(1);
  }

  // Validate export format
  if (exportData.version !== SUPPORTED_VERSION) {
    console.error(`❌ Unsupported export version: ${exportData.version}`);
    console.error(`   Supported version: ${SUPPORTED_VERSION}`);
    process.exit(1);
  }

  console.log(`   Export version: ${exportData.version}`);
  console.log(`   Exported at: ${exportData.exportedAt}`);
  console.log(`   Source DB type: ${exportData.dbType}`);
  console.log(`   Total records: ${exportData.metadata.totalRecords}`);
  console.log("");

  // Confirm before proceeding
  console.log("⚠️  WARNING: This will import data into the target database!");
  console.log(`   Target DB type: ${dbType}`);
  console.log("");

  const clearExisting = await confirm("Clear existing data before import?");
  const confirmed = await confirm("Proceed with import?");

  if (!confirmed) {
    console.log("❌ Import cancelled");
    process.exit(0);
  }

  // Create database connection
  console.log("");
  console.log(`📦 Importing to ${dbType} database...`);

  const db = createDatabase();

  await importToDatabase(db, exportData, clearExisting);

  console.log("");
  console.log(`✅ Import completed successfully!`);
  console.log("");
  console.log("═".repeat(50));
  console.log("");
  console.log("💡 Tip: You may need to run migrations after import:");
  console.log("   bun run db:migrate");

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});

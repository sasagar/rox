#!/usr/bin/env bun
/**
 * Database Export Script (Drizzle ORM)
 *
 * Exports database contents to a database-agnostic JSON format.
 * This allows migration between different database types (PostgreSQL, SQLite/D1, MySQL)
 *
 * Usage:
 *   bun run packages/backend/scripts/export.ts [output-file]
 *
 * Environment Variables:
 *   DB_TYPE       - Database type (postgres, sqlite, mysql)
 *   DATABASE_URL  - Database connection string
 *
 * Examples:
 *   # Export from PostgreSQL to timestamped file
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." bun run packages/backend/scripts/export.ts
 *
 *   # Export to specific file
 *   DB_TYPE=postgres DATABASE_URL="postgresql://..." bun run packages/backend/scripts/export.ts export.json
 */

import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { createDatabase, type Database } from "../src/db/index.js";
import * as pgSchema from "../src/db/schema/pg.js";

const dbType = process.env.DB_TYPE || "postgres";
const ROOT_DIR = join(import.meta.dir, "../../..");

/**
 * Export format version
 * Increment when schema changes
 */
const EXPORT_VERSION = 1;

/**
 * Tables to export in dependency order
 * Maps table name to schema object
 */
const EXPORT_TABLES: Array<{ name: string; schema: any }> = [
  { name: "users", schema: pgSchema.users },
  { name: "sessions", schema: pgSchema.sessions },
  { name: "passkeyCredentials", schema: pgSchema.passkeyCredentials },
  { name: "passkeyChallenges", schema: pgSchema.passkeyChallenges },
  { name: "roles", schema: pgSchema.roles },
  { name: "roleAssignments", schema: pgSchema.roleAssignments },
  { name: "driveFolders", schema: pgSchema.driveFolders },
  { name: "driveFiles", schema: pgSchema.driveFiles },
  { name: "notes", schema: pgSchema.notes },
  { name: "reactions", schema: pgSchema.reactions },
  { name: "follows", schema: pgSchema.follows },
  { name: "receivedActivities", schema: pgSchema.receivedActivities },
  { name: "instanceBlocks", schema: pgSchema.instanceBlocks },
  { name: "invitationCodes", schema: pgSchema.invitationCodes },
  { name: "instanceSettings", schema: pgSchema.instanceSettings },
  { name: "userReports", schema: pgSchema.userReports },
  { name: "moderationAuditLogs", schema: pgSchema.moderationAuditLogs },
  { name: "userWarnings", schema: pgSchema.userWarnings },
  { name: "customEmojis", schema: pgSchema.customEmojis },
  { name: "notifications", schema: pgSchema.notifications },
  { name: "pushSubscriptions", schema: pgSchema.pushSubscriptions },
  { name: "remoteInstances", schema: pgSchema.remoteInstances },
  { name: "scheduledNotes", schema: pgSchema.scheduledNotes },
];

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
 * Generate export filename with timestamp
 */
function generateExportFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `export-${timestamp}.json`;
}

/**
 * Export all tables from database
 */
async function exportFromDatabase(db: Database): Promise<ExportData> {
  const tables: Record<string, unknown[]> = {};
  const tableRecordCounts: Record<string, number> = {};
  let totalRecords = 0;

  for (const { name, schema } of EXPORT_TABLES) {
    try {
      // Use Drizzle to select all records from each table
      const records = await db.select().from(schema);
      tables[name] = records;
      tableRecordCounts[name] = records.length;
      totalRecords += records.length;
      console.log(`   ${name}: ${records.length} records`);
    } catch (error) {
      // Table might not exist
      console.log(`   ${name}: 0 records (table may not exist)`);
      tables[name] = [];
      tableRecordCounts[name] = 0;
    }
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    dbType,
    tables,
    metadata: {
      totalRecords,
      tableRecordCounts,
    },
  };
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log("═".repeat(50));
  console.log("🦊 Rox Database Export (Drizzle)");
  console.log("═".repeat(50));

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    console.error("");
    console.error("Usage:");
    console.error(
      '  DB_TYPE=postgres DATABASE_URL="postgresql://user:pass@host:5432/db" bun run packages/backend/scripts/export.ts',
    );
    process.exit(1);
  }

  // Parse output file path
  const outputArg = process.argv[2];
  const exportsDir = join(ROOT_DIR, "backups");
  const outputFile = outputArg
    ? outputArg.startsWith("/")
      ? outputArg
      : join(process.cwd(), outputArg)
    : join(exportsDir, generateExportFilename());

  const outputDir = dirname(outputFile);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Create database connection
  console.log("");
  console.log(`📦 Exporting from ${dbType} database...`);
  console.log(`   Output: ${outputFile}`);
  console.log("");

  const db = createDatabase();

  const exportData = await exportFromDatabase(db);

  await Bun.write(outputFile, JSON.stringify(exportData, null, 2));

  console.log("");
  console.log(`✅ Export completed successfully!`);
  console.log(`   Total records: ${exportData.metadata.totalRecords}`);

  const file = Bun.file(outputFile);
  const size = file.size;
  const sizeStr =
    size > 1024 * 1024
      ? `${(size / 1024 / 1024).toFixed(2)} MB`
      : `${(size / 1024).toFixed(2)} KB`;
  console.log(`   File size: ${sizeStr}`);

  console.log("");
  console.log("═".repeat(50));

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});

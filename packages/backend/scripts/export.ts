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
import { createDatabase, getDbType, type Database } from "../src/db/index.js";
import * as pgSchema from "../src/db/schema/pg.js";
import * as mysqlSchema from "../src/db/schema/mysql.js";
import * as sqliteSchema from "../src/db/schema/sqlite.js";

const dbType = getDbType();
const ROOT_DIR = join(import.meta.dir, "../../..");

/**
 * Export format version
 * Increment when schema changes
 */
const EXPORT_VERSION = 1;

/**
 * Get schema module based on database type
 */
function getSchema() {
  switch (dbType) {
    case "mysql":
      return mysqlSchema;
    case "sqlite":
    case "d1":
      return sqliteSchema;
    default:
      return pgSchema;
  }
}

/**
 * Tables to export in dependency order
 * Returns table list with schema objects for current DB type
 */
function getExportTables(): Array<{ name: string; schema: any }> {
  const schema = getSchema();
  return [
    { name: "users", schema: schema.users },
    { name: "sessions", schema: schema.sessions },
    { name: "passkeyCredentials", schema: schema.passkeyCredentials },
    { name: "passkeyChallenges", schema: schema.passkeyChallenges },
    { name: "roles", schema: schema.roles },
    { name: "roleAssignments", schema: schema.roleAssignments },
    { name: "driveFolders", schema: schema.driveFolders },
    { name: "driveFiles", schema: schema.driveFiles },
    { name: "notes", schema: schema.notes },
    { name: "reactions", schema: schema.reactions },
    { name: "follows", schema: schema.follows },
    { name: "receivedActivities", schema: schema.receivedActivities },
    { name: "instanceBlocks", schema: schema.instanceBlocks },
    { name: "invitationCodes", schema: schema.invitationCodes },
    { name: "instanceSettings", schema: schema.instanceSettings },
    { name: "userReports", schema: schema.userReports },
    { name: "moderationAuditLogs", schema: schema.moderationAuditLogs },
    { name: "userWarnings", schema: schema.userWarnings },
    { name: "customEmojis", schema: schema.customEmojis },
    { name: "notifications", schema: schema.notifications },
    { name: "pushSubscriptions", schema: schema.pushSubscriptions },
    { name: "remoteInstances", schema: schema.remoteInstances },
    { name: "scheduledNotes", schema: schema.scheduledNotes },
  ];
}

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
  const exportTables = getExportTables();

  for (const { name, schema } of exportTables) {
    try {
      // Use Drizzle to select all records from each table
      const records = await db.select().from(schema);
      tables[name] = records;
      tableRecordCounts[name] = records.length;
      totalRecords += records.length;
      console.log(`   ${name}: ${records.length} records`);
    } catch {
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

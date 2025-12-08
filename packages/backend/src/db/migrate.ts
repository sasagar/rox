/**
 * Database Migration Execution Script
 *
 * Executes Drizzle ORM migrations.
 * Applies migrations to the appropriate database based on environment variables.
 *
 * @module db/migrate
 *
 * @example
 * ```bash
 * # Execute PostgreSQL migration
 * DB_TYPE=postgres DATABASE_URL="postgresql://user:pass@localhost:5432/db" bun run db:migrate
 * ```
 *
 * @remarks
 * - Currently only PostgreSQL is supported
 * - Migration files are placed in `drizzle/{dbType}/`
 * - Database backup recommended before execution
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const dbType = process.env.DB_TYPE || "postgres";

/**
 * Run Migrations
 *
 * Establishes database connection and sequentially executes unapplied migration files.
 * Automatically closes the connection after migration completes.
 *
 * @throws When DATABASE_URL is not set
 * @throws When DB_TYPE is not supported
 * @throws When an error occurs during migration execution
 *
 * @remarks
 * - For PostgreSQL, limits connections to 1 (migration-only)
 * - Automatically terminates the process on error (exit code 1)
 */
async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log(`🔄 Running migrations for ${dbType}...`);
  console.log(`📍 Database: ${databaseUrl.split("@")[1] || "localhost"}`);

  try {
    if (dbType === "postgres") {
      const pool = new Pool({
        connectionString: databaseUrl,
        max: 1, // Single connection for migrations
      });
      const db = drizzle({ client: pool });

      await migrate(db, {
        migrationsFolder: `./drizzle/${dbType}`,
      });

      await pool.end();
      console.log("✅ Migrations completed successfully");
    } else {
      console.error(`❌ Migration for ${dbType} is not yet implemented`);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();

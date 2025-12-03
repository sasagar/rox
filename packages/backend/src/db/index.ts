/**
 * Database Connection Module
 *
 * Establishes appropriate database connections based on environment variables.
 * Supports PostgreSQL, MySQL, and SQLite.
 *
 * @module db
 */

import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import postgres from "postgres";
import mysql from "mysql2/promise";
import Database from "better-sqlite3";
import * as pgSchema from "./schema/pg.js";

const dbType = process.env.DB_TYPE || "postgres";

/**
 * Create Database Connection
 *
 * @returns Drizzle ORM database instance
 * @throws When DATABASE_URL is not set
 * @throws When DB_TYPE is not supported
 */
export function createDatabase(): Database {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  switch (dbType) {
    case "postgres": {
      // Connection pooling configuration
      // postgres.js has built-in connection pooling
      const client = postgres(databaseUrl, {
        max: parseInt(process.env.DB_POOL_MAX || "10", 10), // Max connections in pool
        idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || "20", 10), // Close idle connections after 20s
        max_lifetime: parseInt(process.env.DB_MAX_LIFETIME || "600", 10), // Max connection lifetime 10min (reduced from 30min to prevent timeout overflow)
        connect_timeout: parseInt(process.env.DB_CONNECT_TIMEOUT || "30", 10), // Connection timeout 30s
      });
      return drizzlePg(client, { schema: pgSchema }) as Database;
    }
    case "mysql": {
      const pool = mysql.createPool(databaseUrl);
      return drizzleMysql(pool) as unknown as Database;
    }
    case "sqlite":
    case "d1": {
      const sqlite = new Database(databaseUrl.replace("sqlite://", ""));
      return drizzleSqlite(sqlite) as unknown as Database;
    }
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

/**
 * Drizzle ORM Database Instance Type
 *
 * @remarks
 * Currently only PostgreSQL is implemented, so PostgresJsDatabase type is used.
 * When MySQL/SQLite support is added, this type needs to be changed to a union type.
 */
export type Database = PostgresJsDatabase<typeof pgSchema>;

/**
 * Singleton Database Instance
 */
let dbInstance: Database | null = null;

/**
 * Get Database Instance
 *
 * Implemented using the singleton pattern, establishes a connection on first call.
 * Subsequent calls return the same instance.
 *
 * @returns Database instance
 *
 * @example
 * ```typescript
 * const db = getDatabase();
 * const users = await db.select().from(usersTable);
 * ```
 */
export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

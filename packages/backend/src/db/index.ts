/**
 * Database Connection Module
 *
 * Establishes appropriate database connections based on environment variables.
 * Supports PostgreSQL, MySQL, SQLite, and Cloudflare D1.
 *
 * @module db
 */

import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { drizzle as drizzleSqlite, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Pool } from "pg";
import mysql from "mysql2/promise";
import BetterSqlite3 from "better-sqlite3";
import * as pgSchema from "./schema/pg.js";
import * as mysqlSchema from "./schema/mysql.js";
import * as sqliteSchema from "./schema/sqlite.js";

/**
 * Supported Database Types
 */
export type DbType = "postgres" | "mysql" | "sqlite" | "d1";

const dbType = (process.env.DB_TYPE || "postgres") as DbType;

/**
 * Get Current Database Type
 *
 * @returns The currently configured database type
 */
export function getDbType(): DbType {
  return dbType;
}

/**
 * Create Database Connection
 *
 * Creates a database connection based on DB_TYPE environment variable.
 * Each database type uses its own schema definitions for proper type inference.
 *
 * @returns Drizzle ORM database instance
 * @throws When DATABASE_URL is not set
 * @throws When DB_TYPE is not supported
 *
 * @example
 * ```typescript
 * // PostgreSQL
 * DB_TYPE=postgres DATABASE_URL=postgresql://... bun run dev
 *
 * // MySQL
 * DB_TYPE=mysql DATABASE_URL=mysql://... bun run dev
 *
 * // SQLite
 * DB_TYPE=sqlite DATABASE_URL=sqlite://./data.db bun run dev
 *
 * // Cloudflare D1 (in Workers environment)
 * DB_TYPE=d1 bun run dev
 * ```
 */
export function createDatabase(): Database {
  const databaseUrl = process.env.DATABASE_URL;

  switch (dbType) {
    case "postgres": {
      if (!databaseUrl) {
        throw new Error("DATABASE_URL environment variable is required for PostgreSQL");
      }
      // Connection pooling configuration using node-postgres (pg)
      // node-postgres is more stable for long-running processes
      const pool = new Pool({
        connectionString: databaseUrl,
        max: parseInt(process.env.DB_POOL_MAX || "10", 10), // Max connections in pool
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "20", 10) * 1000, // Close idle connections after 20s
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || "10", 10) * 1000, // Connection timeout 10s
        application_name: "rox",
      });
      return drizzlePg({ client: pool, schema: pgSchema }) as Database;
    }

    case "mysql": {
      if (!databaseUrl) {
        throw new Error("DATABASE_URL environment variable is required for MySQL");
      }
      const pool = mysql.createPool(databaseUrl);
      return drizzleMysql(pool, { schema: mysqlSchema, mode: "default" }) as unknown as Database;
    }

    case "sqlite": {
      if (!databaseUrl) {
        throw new Error("DATABASE_URL environment variable is required for SQLite");
      }
      // Remove sqlite:// prefix if present
      const dbPath = databaseUrl.replace(/^sqlite:\/\//, "");
      const sqlite = new BetterSqlite3(dbPath);
      // Enable WAL mode for better concurrent access
      sqlite.pragma("journal_mode = WAL");
      return drizzleSqlite(sqlite, { schema: sqliteSchema }) as unknown as Database;
    }

    case "d1": {
      // D1 requires the binding to be passed from Cloudflare Workers environment
      // This will be handled separately in the Workers entry point
      // For now, throw an error if someone tries to use D1 outside Workers
      throw new Error(
        "D1 database type requires Cloudflare Workers environment. " +
          "Use createD1Database(d1Binding) instead."
      );
    }

    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

/**
 * Create D1 Database Connection for Cloudflare Workers
 *
 * This function should be called from the Cloudflare Workers entry point
 * with the D1 binding from the environment.
 *
 * @param d1Binding - D1 database binding from Cloudflare Workers env
 * @returns Drizzle ORM database instance for D1
 *
 * @example
 * ```typescript
 * // In Cloudflare Workers entry point
 * import { createD1Database } from "./db/index.js";
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const db = createD1Database(env.DB);
 *     // Use db...
 *   }
 * };
 * ```
 */
export function createD1Database(d1Binding: D1Database): D1DatabaseInstance {
  // Dynamic import to avoid loading d1 driver in non-Workers environment
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzleD1 } = require("drizzle-orm/d1");
  return drizzleD1(d1Binding, { schema: sqliteSchema });
}

/**
 * D1 Database Binding Type (Cloudflare Workers)
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

/**
 * D1 Database Instance Type
 */
export type D1DatabaseInstance = BetterSQLite3Database<typeof sqliteSchema>;

/**
 * Drizzle ORM Database Instance Type
 *
 * @remarks
 * Currently only PostgreSQL is implemented, so NodePgDatabase type is used.
 * When MySQL/SQLite support is added, this type needs to be changed to a union type.
 */
export type Database = NodePgDatabase<typeof pgSchema>;

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

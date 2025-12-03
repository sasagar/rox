import { defineConfig } from "drizzle-kit";

const dbType = process.env.DB_TYPE || "postgres";

// スキーマファイル名のマッピング
const schemaFileMap: Record<string, string> = {
  postgres: "pg",
  mysql: "mysql",
  sqlite: "sqlite",
  d1: "sqlite",
};

const schemaFile = schemaFileMap[dbType] || "pg";

export default defineConfig({
  schema: `./src/db/schema/${schemaFile}.ts`,
  out: `./drizzle/${dbType}`,
  dialect:
    dbType === "sqlite" || dbType === "d1" ? "sqlite" : dbType === "mysql" ? "mysql" : "postgresql",
  dbCredentials:
    dbType === "sqlite" || dbType === "d1"
      ? { url: process.env.DATABASE_URL || "./rox.db" }
      : { url: process.env.DATABASE_URL || "" },
});

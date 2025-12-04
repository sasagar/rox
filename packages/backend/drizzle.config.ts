import { defineConfig } from "drizzle-kit";

const dbType = process.env.DB_TYPE || "postgres";

// Schema file name mapping
const schemaFileMap: Record<string, string> = {
  postgres: "pg",
  mysql: "mysql",
  sqlite: "sqlite",
  d1: "sqlite",
};

const schemaFile = schemaFileMap[dbType] || "pg";

// Get database URL with proper handling for SQLite prefix
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || "";

  if (dbType === "sqlite" || dbType === "d1") {
    // Remove sqlite:// prefix if present
    const cleanUrl = url.replace(/^sqlite:\/\//, "");
    return cleanUrl || "./rox.db";
  }

  return url;
}

export default defineConfig({
  schema: `./src/db/schema/${schemaFile}.ts`,
  out: `./drizzle/${dbType}`,
  dialect:
    dbType === "sqlite" || dbType === "d1" ? "sqlite" : dbType === "mysql" ? "mysql" : "postgresql",
  dbCredentials: { url: getDatabaseUrl() },
});

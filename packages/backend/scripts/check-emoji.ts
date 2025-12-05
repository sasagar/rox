import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { customEmojis } from "../src/db/schema/pg.js";
import { like, isNotNull, desc } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://rox:rox_dev_password@localhost:5432/rox";
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

async function main() {
  // Get all remote emojis (where host is not null)
  const remoteEmojis = await db
    .select()
    .from(customEmojis)
    .where(isNotNull(customEmojis.host))
    .orderBy(desc(customEmojis.createdAt))
    .limit(20);

  console.log("=== Remote Custom Emojis (last 20) ===");
  if (remoteEmojis.length === 0) {
    console.log("No remote emojis found!");
  } else {
    for (const e of remoteEmojis) {
      console.log(`  :${e.name}: from ${e.host} -> ${e.url}`);
    }
  }

  // Search for neko
  const nekoEmojis = await db
    .select()
    .from(customEmojis)
    .where(like(customEmojis.name, "%neko%"))
    .limit(10);

  console.log("\n=== Emojis containing 'neko' ===");
  if (nekoEmojis.length === 0) {
    console.log("No emojis matching 'neko' found!");
  } else {
    for (const e of nekoEmojis) {
      console.log(`  :${e.name}: from ${e.host || "local"} -> ${e.url}`);
    }
  }

  // Total count
  const allEmojis = await db.select().from(customEmojis);
  console.log(`\nTotal custom emojis in database: ${allEmojis.length}`);

  await sql.end();
}

main().catch(console.error);

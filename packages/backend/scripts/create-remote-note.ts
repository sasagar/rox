/**
 * Create a remote note from gtsuser@gts.local in Rox database
 * This allows testing Like activity delivery from Rox → GoToSocial
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { generateId } from "shared";
import { notes, users } from "../src/db/schema/pg.js";
import { eq, and } from "drizzle-orm";

const connectionString =
  process.env.DATABASE_URL || "postgresql://rox:rox_dev_password@localhost:5432/rox";
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  // Find remote gtsuser
  const [gtsuser] = await db
    .select()
    .from(users)
    .where(and(eq(users.username, "gtsuser"), eq(users.host, "gts.local")));
  if (!gtsuser) {
    console.error("❌ gtsuser@gts.local not found");
    process.exit(1);
  }
  console.log(`✅ Found gtsuser: ${gtsuser.id} (inbox: ${gtsuser.inbox})`);

  // Create a unique note ID
  const noteId = generateId();
  const noteUri = `https://gts.local/users/gtsuser/statuses/${noteId}`;

  // Insert the remote note
  await db.insert(notes).values({
    id: noteId,
    userId: gtsuser.id,
    text: "Hello from GoToSocial! This is a test note for Like activity testing.",
    visibility: "public",
    uri: noteUri,
    createdAt: new Date(),
    localOnly: false,
  });

  console.log(`✅ Created remote note: ${noteId}`);
  console.log(`   URI: ${noteUri}`);
  console.log(`   Author: gtsuser@gts.local (${gtsuser.id})`);

  // Verify
  const [verify] = await db.select().from(notes).where(eq(notes.id, noteId));
  console.log("📋 Verification:", verify);

  await client.end();
}

main().catch(console.error);

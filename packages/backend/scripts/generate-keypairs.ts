/**
 * Generate RSA Key Pairs for Existing Users
 *
 * This script generates RSA key pairs for all existing local users
 * that don't have keys yet. Required for ActivityPub federation.
 *
 * Usage:
 *   bun run scripts/generate-keypairs.ts
 */

import { getDatabase } from '../src/db/index.js';
import { users } from '../src/db/schema/pg.js';
import { generateKeyPair } from '../src/utils/crypto.js';
import { eq, isNull, and } from 'drizzle-orm';

async function main() {
  console.log('🔑 Generating RSA key pairs for existing users...\n');

  const db = getDatabase();

  // Find all local users without keys
  const usersWithoutKeys = await db
    .select()
    .from(users)
    .where(
      and(
        isNull(users.host), // ローカルユーザーのみ
        isNull(users.publicKey) // 鍵がまだ生成されていない
      )
    );

  if (usersWithoutKeys.length === 0) {
    console.log('✅ All local users already have key pairs.');
    process.exit(0);
  }

  console.log(`Found ${usersWithoutKeys.length} user(s) without key pairs:\n`);

  for (const user of usersWithoutKeys) {
    console.log(`  - ${user.username} (${user.id})`);

    // Generate key pair
    const { publicKey, privateKey } = generateKeyPair();

    // Update user record
    await db
      .update(users)
      .set({
        publicKey,
        privateKey,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    console.log(`    ✓ Key pair generated`);
  }

  console.log(`\n✅ Successfully generated key pairs for ${usersWithoutKeys.length} user(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error generating key pairs:', error);
  process.exit(1);
});

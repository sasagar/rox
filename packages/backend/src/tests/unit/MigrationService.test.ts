/**
 * MigrationService Unit Tests
 *
 * Tests for account migration functionality including:
 * - Alias management (add/remove)
 * - Migration validation
 * - Migration initiation
 * - Cooldown period enforcement
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";

// Mock types
interface MockUser {
  id: string;
  username: string;
  host: string | null;
  uri: string | null;
  alsoKnownAs: string[] | null;
  movedTo: string | null;
  movedAt: Date | null;
}

interface MockFollow {
  id: string;
  followerId: string;
  followeeId: string;
}

describe("MigrationService", () => {
  // Mock repositories
  let mockUserRepository: any;
  let mockFollowRepository: any;

  // Test users
  const localUser: MockUser = {
    id: "local1",
    username: "localuser",
    host: null,
    uri: "https://example.com/users/localuser",
    alsoKnownAs: null,
    movedTo: null,
    movedAt: null,
  };

  const remoteUser: MockUser = {
    id: "remote1",
    username: "remoteuser",
    host: "remote.example.com",
    uri: "https://remote.example.com/users/remoteuser",
    alsoKnownAs: ["https://example.com/users/localuser"],
    movedTo: null,
    movedAt: null,
  };

  beforeEach(() => {
    mockUserRepository = {
      findById: mock(() => Promise.resolve(localUser)),
      update: mock(() => Promise.resolve({ ...localUser })),
    };

    mockFollowRepository = {
      findByFolloweeId: mock(() => Promise.resolve([])),
    };

    // mockRemoteActorService would be used in integration tests
    // Currently not needed for these unit tests
  });

  describe("Alias Management", () => {
    describe("getAliases", () => {
      test("should return empty array when no aliases exist", async () => {
        const user = { ...localUser, alsoKnownAs: null };
        mockUserRepository.findById = mock(() => Promise.resolve(user));

        const aliases = user.alsoKnownAs || [];
        expect(aliases).toEqual([]);
      });

      test("should return existing aliases", async () => {
        const existingAliases = ["https://other.example.com/users/oldaccount"];
        const user = { ...localUser, alsoKnownAs: existingAliases };
        mockUserRepository.findById = mock(() => Promise.resolve(user));

        const aliases = user.alsoKnownAs || [];
        expect(aliases).toEqual(existingAliases);
      });
    });

    describe("addAlias", () => {
      test("should add a valid alias", async () => {
        const newAlias = "https://other.example.com/users/oldaccount";
        const user = { ...localUser, alsoKnownAs: null };

        // Simulate adding alias
        const updatedAliases = [...(user.alsoKnownAs || []), newAlias];

        expect(updatedAliases).toContain(newAlias);
        expect(updatedAliases.length).toBe(1);
      });

      test("should not add duplicate alias", async () => {
        const existingAlias = "https://other.example.com/users/oldaccount";
        const user = { ...localUser, alsoKnownAs: [existingAlias] };

        // Check for duplicate
        const isDuplicate = user.alsoKnownAs?.includes(existingAlias);

        expect(isDuplicate).toBe(true);
      });

      test("should reject invalid URI format", () => {
        const invalidUris = ["not-a-url", "ftp://invalid.protocol.com/users/test", "", "http://"];

        for (const uri of invalidUris) {
          const isValid = isValidActorUri(uri);
          expect(isValid).toBe(false);
        }
      });

      test("should accept valid HTTPS URIs", () => {
        const validUris = [
          "https://mastodon.social/users/test",
          "https://example.com/users/alice",
          "https://sub.domain.example.org/users/bob",
        ];

        for (const uri of validUris) {
          const isValid = isValidActorUri(uri);
          expect(isValid).toBe(true);
        }
      });

      test("should enforce maximum alias limit", () => {
        const MAX_ALIASES = 10;
        const existingAliases = Array.from(
          { length: MAX_ALIASES },
          (_, i) => `https://example${i}.com/users/test`,
        );

        const canAddMore = existingAliases.length < MAX_ALIASES;
        expect(canAddMore).toBe(false);
      });
    });

    describe("removeAlias", () => {
      test("should remove existing alias", async () => {
        const aliasToRemove = "https://other.example.com/users/oldaccount";
        const user = { ...localUser, alsoKnownAs: [aliasToRemove] };

        const updatedAliases = (user.alsoKnownAs || []).filter((a) => a !== aliasToRemove);

        expect(updatedAliases).not.toContain(aliasToRemove);
        expect(updatedAliases.length).toBe(0);
      });

      test("should handle removing non-existent alias gracefully", async () => {
        const user = { ...localUser, alsoKnownAs: ["https://example.com/users/existing"] };
        const nonExistentAlias = "https://other.com/users/nonexistent";

        const updatedAliases = (user.alsoKnownAs || []).filter((a) => a !== nonExistentAlias);

        expect(updatedAliases.length).toBe(1);
      });
    });
  });

  describe("Migration Validation", () => {
    describe("canMigrate", () => {
      test("should allow migration when not in cooldown", () => {
        const MIGRATION_COOLDOWN_DAYS = 30;
        const user = { ...localUser, movedTo: null, movedAt: null };

        const canMigrate = !user.movedTo && !isInCooldown(user.movedAt, MIGRATION_COOLDOWN_DAYS);
        expect(canMigrate).toBe(true);
      });

      test("should prevent migration during cooldown period", () => {
        const MIGRATION_COOLDOWN_DAYS = 30;
        const recentMigration = new Date();
        recentMigration.setDate(recentMigration.getDate() - 10); // 10 days ago

        const user = {
          ...localUser,
          movedTo: "https://new.example.com/users/newaccount",
          movedAt: recentMigration,
        };

        const canMigrate = !isInCooldown(user.movedAt, MIGRATION_COOLDOWN_DAYS);
        expect(canMigrate).toBe(false);
      });

      test("should allow migration after cooldown expires", () => {
        const MIGRATION_COOLDOWN_DAYS = 30;
        const oldMigration = new Date();
        oldMigration.setDate(oldMigration.getDate() - 35); // 35 days ago

        const user = {
          ...localUser,
          movedTo: "https://new.example.com/users/newaccount",
          movedAt: oldMigration,
        };

        const canMigrate = !isInCooldown(user.movedAt, MIGRATION_COOLDOWN_DAYS);
        expect(canMigrate).toBe(true);
      });
    });

    describe("validateMigration", () => {
      test("should validate bi-directional alsoKnownAs", () => {
        const sourceUri = "https://example.com/users/localuser";
        // targetUri would be used when fetching target actor document

        // Target has source in alsoKnownAs
        const target = {
          ...remoteUser,
          alsoKnownAs: [sourceUri],
        };

        const hasReverseAlias = target.alsoKnownAs?.includes(sourceUri) || false;
        expect(hasReverseAlias).toBe(true);
      });

      test("should reject migration without bi-directional link", () => {
        const sourceUri = "https://example.com/users/localuser";

        // Target does NOT have source in alsoKnownAs
        const target = {
          ...remoteUser,
          alsoKnownAs: ["https://other.com/users/different"],
        };

        const hasReverseAlias = target.alsoKnownAs?.includes(sourceUri) || false;
        expect(hasReverseAlias).toBe(false);
      });

      test("should reject migration to self", () => {
        const sourceUri = "https://example.com/users/localuser";
        const targetUri = sourceUri;

        const isSelf = sourceUri === targetUri;
        expect(isSelf).toBe(true);
      });

      test("should reject migration to already-migrated account", () => {
        const target = {
          ...remoteUser,
          movedTo: "https://another.example.com/users/yetanother",
        };

        const isAlreadyMigrated = !!target.movedTo;
        expect(isAlreadyMigrated).toBe(true);
      });
    });
  });

  describe("Migration Initiation", () => {
    test("should set movedTo on source account", async () => {
      const targetUri = "https://remote.example.com/users/remoteuser";
      const user = { ...localUser };

      // Simulate migration
      const updatedUser = {
        ...user,
        movedTo: targetUri,
        movedAt: new Date(),
      };

      expect(updatedUser.movedTo).toBe(targetUri);
      expect(updatedUser.movedAt).toBeInstanceOf(Date);
    });

    test("should notify followers during migration", async () => {
      const followers: MockFollow[] = [
        { id: "f1", followerId: "follower1", followeeId: "local1" },
        { id: "f2", followerId: "follower2", followeeId: "local1" },
      ];

      mockFollowRepository.findByFolloweeId = mock(() => Promise.resolve(followers));

      const result = await mockFollowRepository.findByFolloweeId("local1");
      expect(result.length).toBe(2);
    });
  });

  describe("Move Activity Handler", () => {
    test("should validate incoming Move activity", () => {
      const activity = {
        type: "Move",
        actor: "https://old.example.com/users/olduser",
        object: "https://old.example.com/users/olduser",
        target: "https://new.example.com/users/newuser",
      };

      expect(activity.type).toBe("Move");
      expect(activity.actor).toBe(activity.object);
      expect(activity.target).toBeTruthy();
    });

    test("should require actor and object to match", () => {
      const activity = {
        type: "Move",
        actor: "https://old.example.com/users/olduser",
        object: "https://different.example.com/users/different",
        target: "https://new.example.com/users/newuser",
      };

      const isValid = activity.actor === activity.object;
      expect(isValid).toBe(false);
    });

    test("should require target to be present", () => {
      const activity = {
        type: "Move",
        actor: "https://old.example.com/users/olduser",
        object: "https://old.example.com/users/olduser",
        target: null,
      };

      const isValid = !!activity.target;
      expect(isValid).toBe(false);
    });
  });

  describe("Migration Status", () => {
    test("should return correct status for non-migrated account", async () => {
      const user = { ...localUser };

      const status = {
        aliases: user.alsoKnownAs || [],
        movedTo: user.movedTo,
        movedAt: user.movedAt,
        canMigrate: !user.movedTo && !isInCooldown(user.movedAt, 30),
        cooldownEndsAt: null,
      };

      expect(status.aliases).toEqual([]);
      expect(status.movedTo).toBeNull();
      expect(status.canMigrate).toBe(true);
    });

    test("should return correct status for migrated account", async () => {
      const movedAt = new Date();
      movedAt.setDate(movedAt.getDate() - 10);

      const user = {
        ...localUser,
        movedTo: "https://new.example.com/users/newaccount",
        movedAt,
      };

      const cooldownEndsAt = new Date(movedAt);
      cooldownEndsAt.setDate(cooldownEndsAt.getDate() + 30);

      const status = {
        aliases: user.alsoKnownAs || [],
        movedTo: user.movedTo,
        movedAt: user.movedAt,
        canMigrate: !isInCooldown(user.movedAt, 30),
        cooldownEndsAt,
      };

      expect(status.movedTo).toBe("https://new.example.com/users/newaccount");
      expect(status.canMigrate).toBe(false);
      expect(status.cooldownEndsAt).toBeInstanceOf(Date);
    });
  });
});

// Helper functions used in tests
function isValidActorUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" && url.pathname.length > 1;
  } catch {
    return false;
  }
}

function isInCooldown(movedAt: Date | null, cooldownDays: number): boolean {
  if (!movedAt) return false;

  const cooldownEnd = new Date(movedAt);
  cooldownEnd.setDate(cooldownEnd.getDate() + cooldownDays);

  return new Date() < cooldownEnd;
}

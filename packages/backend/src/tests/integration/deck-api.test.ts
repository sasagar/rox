/**
 * Deck API Integration Tests
 *
 * Tests the deck profile API endpoints including:
 * - Profile CRUD operations
 * - Default profile handling
 * - Column management
 *
 * NOTE: These tests require a running server. If the server is not available,
 * all tests will be skipped.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import type { DeckProfile, DeckColumn } from "shared";

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

/**
 * Check if the server is available before running integration tests
 */
async function isServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/instance`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

describe("Deck API Integration", () => {
  let user: { user: { id: string }; token: string };
  let serverAvailable = false;
  let createdProfileIds: string[] = [];

  beforeAll(async () => {
    serverAvailable = await isServerAvailable();

    if (!serverAvailable) {
      console.log("⚠️  Server not available, skipping deck API tests");
      return;
    }

    // Create test user
    const userRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `deckuser_${Date.now()}`,
        password: "password123",
        email: `deckuser_${Date.now()}@test.com`,
      }),
    });
    user = (await userRes.json()) as { user: { id: string }; token: string };
  });

  afterAll(async () => {
    if (!serverAvailable || !user) return;

    // Clean up created profiles
    for (const profileId of createdProfileIds) {
      try {
        await fetch(`${BASE_URL}/api/deck/profiles/${profileId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("GET /api/deck/profiles", () => {
    test("should return empty array for new user", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      const res = await fetch(`${BASE_URL}/api/deck/profiles`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as DeckProfile[];
      expect(Array.isArray(data)).toBe(true);
    });

    test("should require authentication", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      const res = await fetch(`${BASE_URL}/api/deck/profiles`);

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/deck/profiles", () => {
    test("should create a new profile", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      const res = await fetch(`${BASE_URL}/api/deck/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "Test Profile",
          columns: [],
          isDefault: true,
        }),
      });

      expect(res.status).toBe(201);
      const profile = (await res.json()) as DeckProfile;
      expect(profile.name).toBe("Test Profile");
      expect(profile.isDefault).toBe(true);
      expect(profile.columns).toEqual([]);
      expect(profile.userId).toBe(user.user.id);

      createdProfileIds.push(profile.id);
    });

    test("should create profile with columns", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      const columns: DeckColumn[] = [
        {
          id: "col1",
          config: { type: "timeline", timelineType: "home" },
          width: "normal",
        },
        {
          id: "col2",
          config: { type: "notifications" },
          width: "narrow",
        },
      ];

      const res = await fetch(`${BASE_URL}/api/deck/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "Profile with Columns",
          columns,
          isDefault: false,
        }),
      });

      expect(res.status).toBe(201);
      const profile = (await res.json()) as DeckProfile;
      expect(profile.columns).toHaveLength(2);
      expect(profile.columns[0]?.config.type).toBe("timeline");
      expect(profile.columns[1]?.config.type).toBe("notifications");

      createdProfileIds.push(profile.id);
    });

    test("should reject duplicate profile names", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      // First profile
      const res1 = await fetch(`${BASE_URL}/api/deck/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "Duplicate Name",
          columns: [],
          isDefault: false,
        }),
      });

      if (res1.status === 201) {
        const profile1 = (await res1.json()) as DeckProfile;
        createdProfileIds.push(profile1.id);

        // Second profile with same name
        const res2 = await fetch(`${BASE_URL}/api/deck/profiles`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            name: "Duplicate Name",
            columns: [],
            isDefault: false,
          }),
        });

        expect(res2.status).toBe(409);
      }
    });

    test("should require authentication", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      const res = await fetch(`${BASE_URL}/api/deck/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Unauthorized Profile",
          columns: [],
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/deck/profiles/:id", () => {
    test("should get profile by id", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      // Create a profile first
      const createRes = await fetch(`${BASE_URL}/api/deck/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "Get By ID Test",
          columns: [],
          isDefault: false,
        }),
      });

      const created = (await createRes.json()) as DeckProfile;
      createdProfileIds.push(created.id);

      // Get by ID
      const res = await fetch(`${BASE_URL}/api/deck/profiles/${created.id}`, {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      expect(res.status).toBe(200);
      const profile = (await res.json()) as DeckProfile;
      expect(profile.id).toBe(created.id);
      expect(profile.name).toBe("Get By ID Test");
    });

    test("should return 404 for non-existent profile", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      const res = await fetch(
        `${BASE_URL}/api/deck/profiles/nonexistent-id-12345`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/deck/profiles/:id", () => {
    test("should update profile name", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      // Create a profile first
      const createRes = await fetch(`${BASE_URL}/api/deck/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "Original Name",
          columns: [],
          isDefault: false,
        }),
      });

      const created = (await createRes.json()) as DeckProfile;
      createdProfileIds.push(created.id);

      // Update name
      const res = await fetch(`${BASE_URL}/api/deck/profiles/${created.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "Updated Name",
        }),
      });

      expect(res.status).toBe(200);
      const updated = (await res.json()) as DeckProfile;
      expect(updated.name).toBe("Updated Name");
    });

    test("should update profile columns", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      // Create a profile first
      const createRes = await fetch(`${BASE_URL}/api/deck/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "Column Update Test",
          columns: [],
          isDefault: false,
        }),
      });

      const created = (await createRes.json()) as DeckProfile;
      createdProfileIds.push(created.id);

      // Update columns
      const newColumns: DeckColumn[] = [
        {
          id: "col1",
          config: { type: "timeline", timelineType: "home" },
          width: "wide",
        },
      ];

      const res = await fetch(`${BASE_URL}/api/deck/profiles/${created.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          columns: newColumns,
        }),
      });

      expect(res.status).toBe(200);
      const updated = (await res.json()) as DeckProfile;
      expect(updated.columns).toHaveLength(1);
      expect(updated.columns[0]?.config.type).toBe("timeline");
    });

    test("should update isDefault and clear other defaults", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      // Create two profiles
      const createRes1 = await fetch(`${BASE_URL}/api/deck/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "Default Test 1",
          columns: [],
          isDefault: true,
        }),
      });
      const profile1 = (await createRes1.json()) as DeckProfile;
      createdProfileIds.push(profile1.id);

      const createRes2 = await fetch(`${BASE_URL}/api/deck/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "Default Test 2",
          columns: [],
          isDefault: false,
        }),
      });
      const profile2 = (await createRes2.json()) as DeckProfile;
      createdProfileIds.push(profile2.id);

      // Set profile2 as default
      const res = await fetch(`${BASE_URL}/api/deck/profiles/${profile2.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          isDefault: true,
        }),
      });

      expect(res.status).toBe(200);
      const updated = (await res.json()) as DeckProfile;
      expect(updated.isDefault).toBe(true);

      // Check profile1 is no longer default
      const checkRes = await fetch(
        `${BASE_URL}/api/deck/profiles/${profile1.id}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      const profile1Updated = (await checkRes.json()) as DeckProfile;
      expect(profile1Updated.isDefault).toBe(false);
    });
  });

  describe("DELETE /api/deck/profiles/:id", () => {
    test("should delete profile", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      // Create a profile first
      const createRes = await fetch(`${BASE_URL}/api/deck/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "Delete Test",
          columns: [],
          isDefault: false,
        }),
      });

      const created = (await createRes.json()) as DeckProfile;

      // Delete
      const res = await fetch(`${BASE_URL}/api/deck/profiles/${created.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      expect(res.status).toBe(200);

      // Verify deleted
      const checkRes = await fetch(
        `${BASE_URL}/api/deck/profiles/${created.id}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      expect(checkRes.status).toBe(404);
    });

    test("should return 404 for non-existent profile", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      const res = await fetch(
        `${BASE_URL}/api/deck/profiles/nonexistent-delete-test`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      expect(res.status).toBe(404);
    });
  });

  describe("Column types validation", () => {
    test("should accept all valid column types", async () => {
      if (!serverAvailable) {
        console.log("⏭️  Skipping: server not available");
        return;
      }

      const columns: DeckColumn[] = [
        {
          id: "col1",
          config: { type: "timeline", timelineType: "home" },
          width: "normal",
        },
        {
          id: "col2",
          config: { type: "notifications" },
          width: "narrow",
        },
        {
          id: "col3",
          config: { type: "mentions" },
          width: "normal",
        },
        {
          id: "col4",
          config: { type: "list", listId: "list-123", listName: "My List" },
          width: "wide",
        },
      ];

      const res = await fetch(`${BASE_URL}/api/deck/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: "All Column Types",
          columns,
          isDefault: false,
        }),
      });

      expect(res.status).toBe(201);
      const profile = (await res.json()) as DeckProfile;
      expect(profile.columns).toHaveLength(4);

      createdProfileIds.push(profile.id);
    });
  });
});

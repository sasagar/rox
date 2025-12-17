/**
 * Deck Profile Repository Unit Tests
 *
 * Tests the deck profile management functionality including
 * CRUD operations and default profile handling.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { DeckProfile, DeckColumn } from "shared";

describe("DeckProfileRepository", () => {
  // Mock deck profile data with correct DeckColumn structure
  const mockColumn: DeckColumn = {
    id: "col1",
    config: { type: "timeline", timelineType: "home" },
    width: "normal",
  };

  const mockProfile: DeckProfile = {
    id: "profile1",
    userId: "user1",
    name: "Default",
    columns: [mockColumn],
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockProfile2: DeckProfile = {
    id: "profile2",
    userId: "user1",
    name: "Work",
    columns: [],
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let mockRepo: {
    create: ReturnType<typeof mock>;
    findById: ReturnType<typeof mock>;
    findByUserId: ReturnType<typeof mock>;
    findDefaultByUserId: ReturnType<typeof mock>;
    existsByUserIdAndName: ReturnType<typeof mock>;
    update: ReturnType<typeof mock>;
    delete: ReturnType<typeof mock>;
    deleteByUserId: ReturnType<typeof mock>;
    clearDefaultForUser: ReturnType<typeof mock>;
    countByUserId: ReturnType<typeof mock>;
  };

  beforeEach(() => {
    mockRepo = {
      create: mock(() => Promise.resolve(mockProfile)),
      findById: mock(() => Promise.resolve(mockProfile)),
      findByUserId: mock(() => Promise.resolve([mockProfile, mockProfile2])),
      findDefaultByUserId: mock(() => Promise.resolve(mockProfile)),
      existsByUserIdAndName: mock(() => Promise.resolve(false)),
      update: mock(() => Promise.resolve(mockProfile)),
      delete: mock(() => Promise.resolve()),
      deleteByUserId: mock(() => Promise.resolve()),
      clearDefaultForUser: mock(() => Promise.resolve()),
      countByUserId: mock(() => Promise.resolve(2)),
    };
  });

  describe("create", () => {
    test("should create a new deck profile", async () => {
      const input = {
        id: "profile1",
        userId: "user1",
        name: "Default",
        columns: [mockColumn],
        isDefault: true,
      };

      const result = await mockRepo.create(input);

      expect(result).toEqual(mockProfile);
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    test("should create profile with empty columns", async () => {
      mockRepo.create = mock(() =>
        Promise.resolve({ ...mockProfile, columns: [] })
      );

      const input = {
        id: "profile3",
        userId: "user1",
        name: "Empty",
        columns: [],
        isDefault: false,
      };

      const result = await mockRepo.create(input);

      expect(result.columns).toEqual([]);
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    test("should set first profile as default", async () => {
      const input = {
        id: "profile1",
        userId: "user1",
        name: "First Profile",
        columns: [],
        isDefault: true,
      };

      await mockRepo.create(input);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true })
      );
    });
  });

  describe("findById", () => {
    test("should find profile by id", async () => {
      const result = await mockRepo.findById("profile1");

      expect(result).toEqual(mockProfile);
      expect(mockRepo.findById).toHaveBeenCalledWith("profile1");
    });

    test("should return null for non-existent profile", async () => {
      mockRepo.findById = mock(() => Promise.resolve(null));

      const result = await mockRepo.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByUserId", () => {
    test("should find all profiles for a user", async () => {
      const result = await mockRepo.findByUserId("user1");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockProfile);
      expect(result[1]).toEqual(mockProfile2);
    });

    test("should return empty array for user with no profiles", async () => {
      mockRepo.findByUserId = mock(() => Promise.resolve([]));

      const result = await mockRepo.findByUserId("newuser");

      expect(result).toEqual([]);
    });
  });

  describe("findDefaultByUserId", () => {
    test("should find default profile for user", async () => {
      const result = await mockRepo.findDefaultByUserId("user1");

      expect(result).toEqual(mockProfile);
      expect(result?.isDefault).toBe(true);
    });

    test("should return null if no default profile exists", async () => {
      mockRepo.findDefaultByUserId = mock(() => Promise.resolve(null));

      const result = await mockRepo.findDefaultByUserId("user2");

      expect(result).toBeNull();
    });
  });

  describe("existsByUserIdAndName", () => {
    test("should return true if profile with name exists", async () => {
      mockRepo.existsByUserIdAndName = mock(() => Promise.resolve(true));

      const result = await mockRepo.existsByUserIdAndName("user1", "Default");

      expect(result).toBe(true);
    });

    test("should return false if profile with name does not exist", async () => {
      const result = await mockRepo.existsByUserIdAndName("user1", "NewProfile");

      expect(result).toBe(false);
    });
  });

  describe("update", () => {
    test("should update profile name", async () => {
      const updatedProfile = { ...mockProfile, name: "Updated Name" };
      mockRepo.update = mock(() => Promise.resolve(updatedProfile));

      const result = await mockRepo.update("profile1", { name: "Updated Name" });

      expect(result.name).toBe("Updated Name");
      expect(mockRepo.update).toHaveBeenCalledWith("profile1", {
        name: "Updated Name",
      });
    });

    test("should update profile columns", async () => {
      const newColumn: DeckColumn = {
        id: "col2",
        config: { type: "notifications" },
        width: "narrow",
      };
      const updatedProfile = { ...mockProfile, columns: [mockColumn, newColumn] };
      mockRepo.update = mock(() => Promise.resolve(updatedProfile));

      const result = await mockRepo.update("profile1", {
        columns: [mockColumn, newColumn],
      });

      expect(result.columns).toHaveLength(2);
    });

    test("should update isDefault and clear other defaults", async () => {
      const updatedProfile2 = { ...mockProfile2, isDefault: true };
      mockRepo.update = mock(() => Promise.resolve(updatedProfile2));

      const result = await mockRepo.update("profile2", { isDefault: true });

      expect(result.isDefault).toBe(true);
    });

    test("should throw error for non-existent profile", async () => {
      mockRepo.update = mock(() =>
        Promise.reject(new Error("Deck profile not found"))
      );

      await expect(
        mockRepo.update("nonexistent", { name: "Test" })
      ).rejects.toThrow("Deck profile not found");
    });
  });

  describe("delete", () => {
    test("should delete profile by id", async () => {
      await mockRepo.delete("profile1");

      expect(mockRepo.delete).toHaveBeenCalledWith("profile1");
    });

    test("should not throw for non-existent profile", async () => {
      await expect(mockRepo.delete("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("deleteByUserId", () => {
    test("should delete all profiles for a user", async () => {
      await mockRepo.deleteByUserId("user1");

      expect(mockRepo.deleteByUserId).toHaveBeenCalledWith("user1");
    });
  });

  describe("clearDefaultForUser", () => {
    test("should clear default flag for all user profiles", async () => {
      await mockRepo.clearDefaultForUser("user1");

      expect(mockRepo.clearDefaultForUser).toHaveBeenCalledWith("user1");
    });
  });

  describe("countByUserId", () => {
    test("should return count of user profiles", async () => {
      const result = await mockRepo.countByUserId("user1");

      expect(result).toBe(2);
    });

    test("should return 0 for user with no profiles", async () => {
      mockRepo.countByUserId = mock(() => Promise.resolve(0));

      const result = await mockRepo.countByUserId("newuser");

      expect(result).toBe(0);
    });
  });

  describe("column types", () => {
    test("should handle timeline column with config", async () => {
      const timelineColumn: DeckColumn = {
        id: "col-timeline",
        config: { type: "timeline", timelineType: "local" },
        width: "wide",
      };

      const profile = { ...mockProfile, columns: [timelineColumn] };
      mockRepo.create = mock(() => Promise.resolve(profile));

      const result = await mockRepo.create({
        id: "profile-new",
        userId: "user1",
        name: "Timeline Profile",
        columns: [timelineColumn],
        isDefault: false,
      });

      expect(result.columns[0].config.type).toBe("timeline");
      if (result.columns[0].config.type === "timeline") {
        expect(result.columns[0].config.timelineType).toBe("local");
      }
    });

    test("should handle notifications column", async () => {
      const notificationsColumn: DeckColumn = {
        id: "col-notifications",
        config: { type: "notifications" },
        width: "normal",
      };

      const profile = { ...mockProfile, columns: [notificationsColumn] };
      mockRepo.findById = mock(() => Promise.resolve(profile));

      const result = await mockRepo.findById("profile1");

      expect(result?.columns[0].config.type).toBe("notifications");
    });

    test("should handle mentions column", async () => {
      const mentionsColumn: DeckColumn = {
        id: "col-mentions",
        config: { type: "mentions" },
        width: "narrow",
      };

      const profile = { ...mockProfile, columns: [mentionsColumn] };
      mockRepo.findById = mock(() => Promise.resolve(profile));

      const result = await mockRepo.findById("profile1");

      expect(result?.columns[0].config.type).toBe("mentions");
    });

    test("should handle list column with listId", async () => {
      const listColumn: DeckColumn = {
        id: "col-list",
        config: { type: "list", listId: "list-123", listName: "My List" },
        width: "normal",
      };

      const profile = { ...mockProfile, columns: [listColumn] };
      mockRepo.findById = mock(() => Promise.resolve(profile));

      const result = await mockRepo.findById("profile1");

      expect(result?.columns[0].config.type).toBe("list");
      if (result?.columns[0].config.type === "list") {
        expect(result.columns[0].config.listId).toBe("list-123");
      }
    });
  });

  describe("column width", () => {
    test("should support narrow width", async () => {
      const column: DeckColumn = {
        ...mockColumn,
        width: "narrow",
      };
      const profile = { ...mockProfile, columns: [column] };
      mockRepo.findById = mock(() => Promise.resolve(profile));

      const result = await mockRepo.findById("profile1");

      expect(result?.columns[0].width).toBe("narrow");
    });

    test("should support normal width", async () => {
      const column: DeckColumn = {
        ...mockColumn,
        width: "normal",
      };
      const profile = { ...mockProfile, columns: [column] };
      mockRepo.findById = mock(() => Promise.resolve(profile));

      const result = await mockRepo.findById("profile1");

      expect(result?.columns[0].width).toBe("normal");
    });

    test("should support wide width", async () => {
      const column: DeckColumn = {
        ...mockColumn,
        width: "wide",
      };
      const profile = { ...mockProfile, columns: [column] };
      mockRepo.findById = mock(() => Promise.resolve(profile));

      const result = await mockRepo.findById("profile1");

      expect(result?.columns[0].width).toBe("wide");
    });
  });
});

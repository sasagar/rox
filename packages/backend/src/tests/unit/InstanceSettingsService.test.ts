/**
 * InstanceSettingsService Unit Tests
 *
 * Tests instance settings management including registration settings,
 * instance metadata, and public instance information
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { InstanceSettingsService } from "../../services/InstanceSettingsService.js";
import type {
  IInstanceSettingsRepository,
  InstanceSettingKey,
} from "../../interfaces/repositories/IInstanceSettingsRepository.js";
import type { InstanceSetting } from "../../db/schema/pg.js";

/**
 * Mock settings repo type
 */
interface MockSettingsRepo {
  get: ReturnType<typeof mock>;
  set: ReturnType<typeof mock>;
  getMany: ReturnType<typeof mock>;
  getAll: ReturnType<typeof mock>;
  getAllAsObject: ReturnType<typeof mock>;
  delete: ReturnType<typeof mock>;
  exists: ReturnType<typeof mock>;
}

describe("InstanceSettingsService", () => {
  // Mock repositories
  let mockSettingsRepo: MockSettingsRepo;
  let settingsStore: Map<string, unknown>;

  beforeEach(() => {
    settingsStore = new Map();

    mockSettingsRepo = {
      get: mock((key: InstanceSettingKey) => Promise.resolve(settingsStore.get(key) ?? null)),
      set: mock((key: InstanceSettingKey, value: unknown) => {
        settingsStore.set(key, value);
        return Promise.resolve({
          key,
          value: JSON.stringify(value),
          updatedById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as InstanceSetting);
      }),
      getMany: mock((keys: InstanceSettingKey[]) => {
        const result = new Map<InstanceSettingKey, unknown>();
        for (const key of keys) {
          const value = settingsStore.get(key);
          if (value !== undefined) {
            result.set(key, value);
          }
        }
        return Promise.resolve(result);
      }),
      getAll: mock(() =>
        Promise.resolve(
          Array.from(settingsStore.entries()).map(([key, value]) => ({
            key,
            value: JSON.stringify(value),
            updatedById: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })) as InstanceSetting[],
        ),
      ),
      getAllAsObject: mock(() => {
        const result: Record<string, unknown> = {};
        for (const [key, value] of settingsStore.entries()) {
          result[key] = value;
        }
        return Promise.resolve(result);
      }),
      delete: mock((key: InstanceSettingKey) => {
        const existed = settingsStore.has(key);
        settingsStore.delete(key);
        return Promise.resolve(existed);
      }),
      exists: mock((key: InstanceSettingKey) => Promise.resolve(settingsStore.has(key))),
    };
  });

  describe("Registration Settings", () => {
    describe("isRegistrationEnabled", () => {
      test("should return true by default when not set", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const enabled = await service.isRegistrationEnabled();

        expect(enabled).toBe(true);
      });

      test("should return false when explicitly disabled", async () => {
        settingsStore.set("registration.enabled", false);

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const enabled = await service.isRegistrationEnabled();

        expect(enabled).toBe(false);
      });

      test("should return true when explicitly enabled", async () => {
        settingsStore.set("registration.enabled", true);

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const enabled = await service.isRegistrationEnabled();

        expect(enabled).toBe(true);
      });
    });

    describe("setRegistrationEnabled", () => {
      test("should update registration enabled setting", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        await service.setRegistrationEnabled(false, "admin1");

        expect(mockSettingsRepo.set).toHaveBeenCalledWith("registration.enabled", false, "admin1");
        expect(settingsStore.get("registration.enabled")).toBe(false);
      });
    });

    describe("isInviteOnly", () => {
      test("should return false by default", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const inviteOnly = await service.isInviteOnly();

        expect(inviteOnly).toBe(false);
      });

      test("should return true when invite-only is enabled", async () => {
        settingsStore.set("registration.inviteOnly", true);

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const inviteOnly = await service.isInviteOnly();

        expect(inviteOnly).toBe(true);
      });
    });

    describe("setInviteOnly", () => {
      test("should update invite-only setting", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        await service.setInviteOnly(true, "admin1");

        expect(mockSettingsRepo.set).toHaveBeenCalledWith(
          "registration.inviteOnly",
          true,
          "admin1",
        );
        expect(settingsStore.get("registration.inviteOnly")).toBe(true);
      });
    });

    describe("isApprovalRequired", () => {
      test("should return false by default", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const approvalRequired = await service.isApprovalRequired();

        expect(approvalRequired).toBe(false);
      });

      test("should return true when approval is required", async () => {
        settingsStore.set("registration.approvalRequired", true);

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const approvalRequired = await service.isApprovalRequired();

        expect(approvalRequired).toBe(true);
      });
    });

    describe("getRegistrationSettings", () => {
      test("should return all registration settings", async () => {
        settingsStore.set("registration.enabled", false);
        settingsStore.set("registration.inviteOnly", true);
        settingsStore.set("registration.approvalRequired", true);

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const settings = await service.getRegistrationSettings();

        expect(settings.enabled).toBe(false);
        expect(settings.inviteOnly).toBe(true);
        expect(settings.approvalRequired).toBe(true);
      });

      test("should return default values when not set", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const settings = await service.getRegistrationSettings();

        expect(settings.enabled).toBe(true);
        expect(settings.inviteOnly).toBe(false);
        expect(settings.approvalRequired).toBe(false);
      });
    });

    describe("updateRegistrationSettings", () => {
      test("should update multiple settings at once", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        await service.updateRegistrationSettings(
          {
            enabled: false,
            inviteOnly: true,
          },
          "admin1",
        );

        expect(settingsStore.get("registration.enabled")).toBe(false);
        expect(settingsStore.get("registration.inviteOnly")).toBe(true);
      });

      test("should only update provided settings", async () => {
        settingsStore.set("registration.enabled", true);
        settingsStore.set("registration.inviteOnly", false);

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        await service.updateRegistrationSettings(
          {
            inviteOnly: true,
          },
          "admin1",
        );

        // enabled should remain unchanged
        expect(settingsStore.get("registration.enabled")).toBe(true);
        expect(settingsStore.get("registration.inviteOnly")).toBe(true);
      });
    });
  });

  describe("Instance Metadata", () => {
    describe("getInstanceName", () => {
      test("should return default name when not set", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const name = await service.getInstanceName();

        expect(name).toBe("Rox Instance");
      });

      test("should return custom name when set", async () => {
        settingsStore.set("instance.name", "My Custom Instance");

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const name = await service.getInstanceName();

        expect(name).toBe("My Custom Instance");
      });
    });

    describe("setInstanceName", () => {
      test("should update instance name", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        await service.setInstanceName("New Instance Name", "admin1");

        expect(mockSettingsRepo.set).toHaveBeenCalledWith(
          "instance.name",
          "New Instance Name",
          "admin1",
        );
      });
    });

    describe("getInstanceDescription", () => {
      test("should return default description when not set", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const desc = await service.getInstanceDescription();

        expect(desc).toBe("A lightweight ActivityPub server");
      });

      test("should return custom description when set", async () => {
        settingsStore.set("instance.description", "My custom description");

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const desc = await service.getInstanceDescription();

        expect(desc).toBe("My custom description");
      });
    });

    describe("getMaintainerEmail", () => {
      test("should return empty string by default", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const email = await service.getMaintainerEmail();

        expect(email).toBe("");
      });

      test("should return custom email when set", async () => {
        settingsStore.set("instance.maintainerEmail", "admin@example.com");

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const email = await service.getMaintainerEmail();

        expect(email).toBe("admin@example.com");
      });
    });

    describe("getIconUrl", () => {
      test("should return null by default", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const iconUrl = await service.getIconUrl();

        expect(iconUrl).toBeNull();
      });

      test("should return custom icon URL when set", async () => {
        settingsStore.set("instance.iconUrl", "https://example.com/icon.png");

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const iconUrl = await service.getIconUrl();

        expect(iconUrl).toBe("https://example.com/icon.png");
      });
    });

    describe("setIconUrl", () => {
      test("should update icon URL", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        await service.setIconUrl("https://example.com/icon.png", "admin1");

        expect(mockSettingsRepo.set).toHaveBeenCalledWith(
          "instance.iconUrl",
          "https://example.com/icon.png",
          "admin1",
        );
      });

      test("should delete icon URL when set to null", async () => {
        settingsStore.set("instance.iconUrl", "https://example.com/icon.png");

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        await service.setIconUrl(null, "admin1");

        expect(mockSettingsRepo.delete).toHaveBeenCalledWith("instance.iconUrl");
      });
    });

    describe("getInstanceMetadata", () => {
      test("should return all metadata with defaults", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const metadata = await service.getInstanceMetadata();

        expect(metadata.name).toBe("Rox Instance");
        expect(metadata.description).toBe("A lightweight ActivityPub server");
        expect(metadata.maintainerEmail).toBe("");
        expect(metadata.iconUrl).toBeNull();
        expect(metadata.bannerUrl).toBeNull();
        expect(metadata.tosUrl).toBeNull();
        expect(metadata.privacyPolicyUrl).toBeNull();
      });

      test("should return custom metadata when set", async () => {
        settingsStore.set("instance.name", "Custom Instance");
        settingsStore.set("instance.description", "Custom description");
        settingsStore.set("instance.maintainerEmail", "admin@example.com");
        settingsStore.set("instance.iconUrl", "https://example.com/icon.png");
        settingsStore.set("instance.tosUrl", "https://example.com/tos");

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const metadata = await service.getInstanceMetadata();

        expect(metadata.name).toBe("Custom Instance");
        expect(metadata.description).toBe("Custom description");
        expect(metadata.maintainerEmail).toBe("admin@example.com");
        expect(metadata.iconUrl).toBe("https://example.com/icon.png");
        expect(metadata.tosUrl).toBe("https://example.com/tos");
      });
    });

    describe("updateInstanceMetadata", () => {
      test("should update multiple metadata fields", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        await service.updateInstanceMetadata(
          {
            name: "New Name",
            description: "New Description",
            maintainerEmail: "new@example.com",
          },
          "admin1",
        );

        expect(settingsStore.get("instance.name")).toBe("New Name");
        expect(settingsStore.get("instance.description")).toBe("New Description");
        expect(settingsStore.get("instance.maintainerEmail")).toBe("new@example.com");
      });
    });
  });

  describe("Public Instance Info", () => {
    describe("getPublicInstanceInfo", () => {
      test("should return combined metadata and registration settings", async () => {
        settingsStore.set("instance.name", "My Instance");
        settingsStore.set("instance.description", "A cool instance");
        settingsStore.set("registration.enabled", true);
        settingsStore.set("registration.inviteOnly", true);
        settingsStore.set("registration.approvalRequired", false);

        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const info = await service.getPublicInstanceInfo();

        expect(info.name).toBe("My Instance");
        expect(info.description).toBe("A cool instance");
        expect(info.registrationEnabled).toBe(true);
        expect(info.inviteOnly).toBe(true);
        expect(info.approvalRequired).toBe(false);
      });

      test("should return default values when nothing is set", async () => {
        const service = new InstanceSettingsService(
          mockSettingsRepo as unknown as IInstanceSettingsRepository,
        );

        const info = await service.getPublicInstanceInfo();

        expect(info.name).toBe("Rox Instance");
        expect(info.description).toBe("A lightweight ActivityPub server");
        expect(info.registrationEnabled).toBe(true);
        expect(info.inviteOnly).toBe(false);
        expect(info.approvalRequired).toBe(false);
      });
    });
  });
});

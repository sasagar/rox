/**
 * InstanceSettingsService
 *
 * Service for managing instance-wide settings stored in the database.
 * Provides typed accessors for common settings with Redis caching support.
 */

import type {
  IInstanceSettingsRepository,
  InstanceSettingKey,
} from "../interfaces/repositories/IInstanceSettingsRepository.js";
import type { ICacheService } from "../interfaces/ICacheService.js";
import { CacheTTL, CachePrefix } from "../adapters/cache/DragonflyCacheAdapter.js";

/**
 * Instance registration settings
 */
export interface RegistrationSettings {
  enabled: boolean;
  inviteOnly: boolean;
  approvalRequired: boolean;
}

/**
 * Instance metadata settings
 */
export interface InstanceMetadata {
  name: string;
  description: string;
  maintainerEmail: string;
  iconUrl: string | null;
  darkIconUrl: string | null;
  bannerUrl: string | null;
  faviconUrl: string | null;
  pwaIcon192Url: string | null;
  pwaIcon512Url: string | null;
  /** Maskable icons for PWA (with safe zone padding for OS icon masks) */
  pwaMaskableIcon192Url: string | null;
  pwaMaskableIcon512Url: string | null;
  tosUrl: string | null;
  privacyPolicyUrl: string | null;
  sourceCodeUrl: string | null;
}

/**
 * Theme settings
 */
export interface ThemeSettings {
  primaryColor: string;
  darkMode: "light" | "dark" | "system";
  /** Theme color for NodeInfo/external services (separate from internal primaryColor) */
  nodeInfoThemeColor: string | null;
}

/**
 * Default registration settings
 */
const DEFAULT_REGISTRATION: RegistrationSettings = {
  enabled: true,
  inviteOnly: false,
  approvalRequired: false,
};

/**
 * Default instance metadata
 */
const DEFAULT_METADATA: InstanceMetadata = {
  name: "Rox Instance",
  description: "A lightweight ActivityPub server",
  maintainerEmail: "",
  iconUrl: null,
  darkIconUrl: null,
  bannerUrl: null,
  faviconUrl: null,
  pwaIcon192Url: null,
  pwaIcon512Url: null,
  pwaMaskableIcon192Url: null,
  pwaMaskableIcon512Url: null,
  tosUrl: null,
  privacyPolicyUrl: null,
  sourceCodeUrl: "https://github.com/Love-Rox/rox",
};

/**
 * Default theme settings
 * Primary color is in OKLCH format hue value (0-360)
 */
const DEFAULT_THEME: ThemeSettings = {
  primaryColor: "#3b82f6", // Blue as default
  darkMode: "system",
  nodeInfoThemeColor: null, // Falls back to primaryColor when null
};

export class InstanceSettingsService {
  private readonly settingsRepository: IInstanceSettingsRepository;
  private readonly cacheService: ICacheService | null;

  constructor(settingsRepository: IInstanceSettingsRepository, cacheService?: ICacheService) {
    this.settingsRepository = settingsRepository;
    this.cacheService = cacheService ?? null;
  }

  /**
   * Get cache key for a setting
   */
  private getCacheKey(key: InstanceSettingKey): string {
    return `${CachePrefix.INSTANCE_SETTINGS}:${key}`;
  }

  /**
   * Invalidate cache for a setting
   */
  private async invalidateCache(key: InstanceSettingKey): Promise<void> {
    if (this.cacheService?.isAvailable()) {
      await this.cacheService.delete(this.getCacheKey(key));
      // Also invalidate composite caches
      await this.cacheService.delete(`${CachePrefix.INSTANCE_SETTINGS}:registration`);
      await this.cacheService.delete(`${CachePrefix.INSTANCE_SETTINGS}:metadata`);
      await this.cacheService.delete(`${CachePrefix.INSTANCE_SETTINGS}:theme`);
      await this.cacheService.delete(`${CachePrefix.INSTANCE_SETTINGS}:public`);
    }
  }

  /**
   * Get a cached value or fetch from repository
   */
  private async getCachedValue<T>(key: InstanceSettingKey, defaultValue: T): Promise<T> {
    const cacheKey = this.getCacheKey(key);

    // Try cache first
    if (this.cacheService?.isAvailable()) {
      const cached = await this.cacheService.get<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Fetch from repository
    const value = await this.settingsRepository.get<T>(key);
    const result = value ?? defaultValue;

    // Cache the result
    if (this.cacheService?.isAvailable()) {
      await this.cacheService.set(cacheKey, result, { ttl: CacheTTL.LONG });
    }

    return result;
  }

  // ================================
  // Registration Settings
  // ================================

  /**
   * Check if user registration is enabled
   */
  async isRegistrationEnabled(): Promise<boolean> {
    return this.getCachedValue("registration.enabled", DEFAULT_REGISTRATION.enabled);
  }

  /**
   * Set registration enabled/disabled
   */
  async setRegistrationEnabled(enabled: boolean, updatedById?: string): Promise<void> {
    await this.settingsRepository.set("registration.enabled", enabled, updatedById);
    await this.invalidateCache("registration.enabled");
  }

  /**
   * Check if registration requires an invitation code
   */
  async isInviteOnly(): Promise<boolean> {
    return this.getCachedValue("registration.inviteOnly", DEFAULT_REGISTRATION.inviteOnly);
  }

  /**
   * Set invite-only mode
   */
  async setInviteOnly(inviteOnly: boolean, updatedById?: string): Promise<void> {
    await this.settingsRepository.set("registration.inviteOnly", inviteOnly, updatedById);
    await this.invalidateCache("registration.inviteOnly");
  }

  /**
   * Check if registration requires admin approval
   */
  async isApprovalRequired(): Promise<boolean> {
    return this.getCachedValue(
      "registration.approvalRequired",
      DEFAULT_REGISTRATION.approvalRequired,
    );
  }

  /**
   * Set approval-required mode
   */
  async setApprovalRequired(required: boolean, updatedById?: string): Promise<void> {
    await this.settingsRepository.set("registration.approvalRequired", required, updatedById);
    await this.invalidateCache("registration.approvalRequired");
  }

  /**
   * Get all registration settings
   */
  async getRegistrationSettings(): Promise<RegistrationSettings> {
    const cacheKey = `${CachePrefix.INSTANCE_SETTINGS}:registration`;

    // Try cache first
    if (this.cacheService?.isAvailable()) {
      const cached = await this.cacheService.get<RegistrationSettings>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const keys: InstanceSettingKey[] = [
      "registration.enabled",
      "registration.inviteOnly",
      "registration.approvalRequired",
    ];
    const values = await this.settingsRepository.getMany(keys);

    const result: RegistrationSettings = {
      enabled: (values.get("registration.enabled") as boolean) ?? DEFAULT_REGISTRATION.enabled,
      inviteOnly:
        (values.get("registration.inviteOnly") as boolean) ?? DEFAULT_REGISTRATION.inviteOnly,
      approvalRequired:
        (values.get("registration.approvalRequired") as boolean) ??
        DEFAULT_REGISTRATION.approvalRequired,
    };

    // Cache the result
    if (this.cacheService?.isAvailable()) {
      await this.cacheService.set(cacheKey, result, { ttl: CacheTTL.LONG });
    }

    return result;
  }

  /**
   * Update multiple registration settings at once
   */
  async updateRegistrationSettings(
    settings: Partial<RegistrationSettings>,
    updatedById?: string,
  ): Promise<void> {
    const updates: Array<{ key: InstanceSettingKey; value: boolean }> = [];

    if (settings.enabled !== undefined) {
      updates.push({ key: "registration.enabled", value: settings.enabled });
    }
    if (settings.inviteOnly !== undefined) {
      updates.push({ key: "registration.inviteOnly", value: settings.inviteOnly });
    }
    if (settings.approvalRequired !== undefined) {
      updates.push({ key: "registration.approvalRequired", value: settings.approvalRequired });
    }

    for (const { key, value } of updates) {
      await this.settingsRepository.set(key, value, updatedById);
      await this.invalidateCache(key);
    }
  }

  // ================================
  // Instance Metadata
  // ================================

  /**
   * Get instance name
   */
  async getInstanceName(): Promise<string> {
    return this.getCachedValue("instance.name", DEFAULT_METADATA.name);
  }

  /**
   * Set instance name
   */
  async setInstanceName(name: string, updatedById?: string): Promise<void> {
    await this.settingsRepository.set("instance.name", name, updatedById);
    await this.invalidateCache("instance.name");
  }

  /**
   * Get instance description
   */
  async getInstanceDescription(): Promise<string> {
    return this.getCachedValue("instance.description", DEFAULT_METADATA.description);
  }

  /**
   * Set instance description
   */
  async setInstanceDescription(description: string, updatedById?: string): Promise<void> {
    await this.settingsRepository.set("instance.description", description, updatedById);
    await this.invalidateCache("instance.description");
  }

  /**
   * Get maintainer email
   */
  async getMaintainerEmail(): Promise<string> {
    return this.getCachedValue("instance.maintainerEmail", DEFAULT_METADATA.maintainerEmail);
  }

  /**
   * Set maintainer email
   */
  async setMaintainerEmail(email: string, updatedById?: string): Promise<void> {
    await this.settingsRepository.set("instance.maintainerEmail", email, updatedById);
    await this.invalidateCache("instance.maintainerEmail");
  }

  /**
   * Get instance icon URL
   */
  async getIconUrl(): Promise<string | null> {
    return this.getCachedValue<string | null>("instance.iconUrl", DEFAULT_METADATA.iconUrl);
  }

  /**
   * Set instance icon URL
   */
  async setIconUrl(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete("instance.iconUrl");
    } else {
      await this.settingsRepository.set("instance.iconUrl", url, updatedById);
    }
    await this.invalidateCache("instance.iconUrl");
  }

  /**
   * Get instance dark mode icon URL
   */
  async getDarkIconUrl(): Promise<string | null> {
    return this.getCachedValue<string | null>("instance.darkIconUrl", DEFAULT_METADATA.darkIconUrl);
  }

  /**
   * Set instance dark mode icon URL
   */
  async setDarkIconUrl(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete("instance.darkIconUrl");
    } else {
      await this.settingsRepository.set("instance.darkIconUrl", url, updatedById);
    }
    await this.invalidateCache("instance.darkIconUrl");
  }

  /**
   * Get instance banner URL
   */
  async getBannerUrl(): Promise<string | null> {
    return this.getCachedValue<string | null>("instance.bannerUrl", DEFAULT_METADATA.bannerUrl);
  }

  /**
   * Set instance banner URL
   */
  async setBannerUrl(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete("instance.bannerUrl");
    } else {
      await this.settingsRepository.set("instance.bannerUrl", url, updatedById);
    }
    await this.invalidateCache("instance.bannerUrl");
  }

  /**
   * Get instance favicon URL
   */
  async getFaviconUrl(): Promise<string | null> {
    return this.getCachedValue<string | null>("instance.faviconUrl", DEFAULT_METADATA.faviconUrl);
  }

  /**
   * Set instance favicon URL
   */
  async setFaviconUrl(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete("instance.faviconUrl");
    } else {
      await this.settingsRepository.set("instance.faviconUrl", url, updatedById);
    }
    await this.invalidateCache("instance.faviconUrl");
  }

  /**
   * Get PWA icon 192x192 URL
   */
  async getPwaIcon192Url(): Promise<string | null> {
    return this.getCachedValue<string | null>("instance.pwaIcon192Url", DEFAULT_METADATA.pwaIcon192Url);
  }

  /**
   * Set PWA icon 192x192 URL
   */
  async setPwaIcon192Url(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete("instance.pwaIcon192Url");
    } else {
      await this.settingsRepository.set("instance.pwaIcon192Url", url, updatedById);
    }
    await this.invalidateCache("instance.pwaIcon192Url");
  }

  /**
   * Get PWA icon 512x512 URL
   */
  async getPwaIcon512Url(): Promise<string | null> {
    return this.getCachedValue<string | null>("instance.pwaIcon512Url", DEFAULT_METADATA.pwaIcon512Url);
  }

  /**
   * Set PWA icon 512x512 URL
   */
  async setPwaIcon512Url(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete("instance.pwaIcon512Url");
    } else {
      await this.settingsRepository.set("instance.pwaIcon512Url", url, updatedById);
    }
    await this.invalidateCache("instance.pwaIcon512Url");
  }

  /**
   * Get PWA maskable icon 192x192 URL
   */
  async getPwaMaskableIcon192Url(): Promise<string | null> {
    return this.getCachedValue<string | null>(
      "instance.pwaMaskableIcon192Url",
      DEFAULT_METADATA.pwaMaskableIcon192Url,
    );
  }

  /**
   * Set PWA maskable icon 192x192 URL
   */
  async setPwaMaskableIcon192Url(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete("instance.pwaMaskableIcon192Url");
    } else {
      await this.settingsRepository.set("instance.pwaMaskableIcon192Url", url, updatedById);
    }
    await this.invalidateCache("instance.pwaMaskableIcon192Url");
  }

  /**
   * Get PWA maskable icon 512x512 URL
   */
  async getPwaMaskableIcon512Url(): Promise<string | null> {
    return this.getCachedValue<string | null>(
      "instance.pwaMaskableIcon512Url",
      DEFAULT_METADATA.pwaMaskableIcon512Url,
    );
  }

  /**
   * Set PWA maskable icon 512x512 URL
   */
  async setPwaMaskableIcon512Url(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete("instance.pwaMaskableIcon512Url");
    } else {
      await this.settingsRepository.set("instance.pwaMaskableIcon512Url", url, updatedById);
    }
    await this.invalidateCache("instance.pwaMaskableIcon512Url");
  }

  /**
   * Get Terms of Service URL
   */
  async getTosUrl(): Promise<string | null> {
    return this.getCachedValue<string | null>("instance.tosUrl", DEFAULT_METADATA.tosUrl);
  }

  /**
   * Set Terms of Service URL
   */
  async setTosUrl(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete("instance.tosUrl");
    } else {
      await this.settingsRepository.set("instance.tosUrl", url, updatedById);
    }
    await this.invalidateCache("instance.tosUrl");
  }

  /**
   * Get Privacy Policy URL
   */
  async getPrivacyPolicyUrl(): Promise<string | null> {
    return this.getCachedValue<string | null>(
      "instance.privacyPolicyUrl",
      DEFAULT_METADATA.privacyPolicyUrl,
    );
  }

  /**
   * Set Privacy Policy URL
   */
  async setPrivacyPolicyUrl(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete("instance.privacyPolicyUrl");
    } else {
      await this.settingsRepository.set("instance.privacyPolicyUrl", url, updatedById);
    }
    await this.invalidateCache("instance.privacyPolicyUrl");
  }

  /**
   * Get Source Code URL (AGPL-3.0 compliance)
   */
  async getSourceCodeUrl(): Promise<string | null> {
    return this.getCachedValue<string | null>(
      "instance.sourceCodeUrl",
      DEFAULT_METADATA.sourceCodeUrl,
    );
  }

  /**
   * Set Source Code URL (AGPL-3.0 compliance)
   */
  async setSourceCodeUrl(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete("instance.sourceCodeUrl");
    } else {
      await this.settingsRepository.set("instance.sourceCodeUrl", url, updatedById);
    }
    await this.invalidateCache("instance.sourceCodeUrl");
  }

  /**
   * Get all instance metadata
   */
  async getInstanceMetadata(): Promise<InstanceMetadata> {
    const cacheKey = `${CachePrefix.INSTANCE_SETTINGS}:metadata`;

    // Try cache first
    if (this.cacheService?.isAvailable()) {
      const cached = await this.cacheService.get<InstanceMetadata>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const keys: InstanceSettingKey[] = [
      "instance.name",
      "instance.description",
      "instance.maintainerEmail",
      "instance.iconUrl",
      "instance.darkIconUrl",
      "instance.bannerUrl",
      "instance.faviconUrl",
      "instance.pwaIcon192Url",
      "instance.pwaIcon512Url",
      "instance.pwaMaskableIcon192Url",
      "instance.pwaMaskableIcon512Url",
      "instance.tosUrl",
      "instance.privacyPolicyUrl",
      "instance.sourceCodeUrl",
    ];
    const values = await this.settingsRepository.getMany(keys);

    const result: InstanceMetadata = {
      name: (values.get("instance.name") as string) ?? DEFAULT_METADATA.name,
      description: (values.get("instance.description") as string) ?? DEFAULT_METADATA.description,
      maintainerEmail:
        (values.get("instance.maintainerEmail") as string) ?? DEFAULT_METADATA.maintainerEmail,
      iconUrl: (values.get("instance.iconUrl") as string | null) ?? DEFAULT_METADATA.iconUrl,
      darkIconUrl:
        (values.get("instance.darkIconUrl") as string | null) ?? DEFAULT_METADATA.darkIconUrl,
      bannerUrl: (values.get("instance.bannerUrl") as string | null) ?? DEFAULT_METADATA.bannerUrl,
      faviconUrl:
        (values.get("instance.faviconUrl") as string | null) ?? DEFAULT_METADATA.faviconUrl,
      pwaIcon192Url:
        (values.get("instance.pwaIcon192Url") as string | null) ?? DEFAULT_METADATA.pwaIcon192Url,
      pwaIcon512Url:
        (values.get("instance.pwaIcon512Url") as string | null) ?? DEFAULT_METADATA.pwaIcon512Url,
      pwaMaskableIcon192Url:
        (values.get("instance.pwaMaskableIcon192Url") as string | null) ??
        DEFAULT_METADATA.pwaMaskableIcon192Url,
      pwaMaskableIcon512Url:
        (values.get("instance.pwaMaskableIcon512Url") as string | null) ??
        DEFAULT_METADATA.pwaMaskableIcon512Url,
      tosUrl: (values.get("instance.tosUrl") as string | null) ?? DEFAULT_METADATA.tosUrl,
      privacyPolicyUrl:
        (values.get("instance.privacyPolicyUrl") as string | null) ??
        DEFAULT_METADATA.privacyPolicyUrl,
      sourceCodeUrl:
        (values.get("instance.sourceCodeUrl") as string | null) ??
        DEFAULT_METADATA.sourceCodeUrl,
    };

    // Cache the result
    if (this.cacheService?.isAvailable()) {
      await this.cacheService.set(cacheKey, result, { ttl: CacheTTL.LONG });
    }

    return result;
  }

  /**
   * Update multiple metadata settings at once
   */
  async updateInstanceMetadata(
    metadata: Partial<InstanceMetadata>,
    updatedById?: string,
  ): Promise<void> {
    if (metadata.name !== undefined) {
      await this.settingsRepository.set("instance.name", metadata.name, updatedById);
      await this.invalidateCache("instance.name");
    }
    if (metadata.description !== undefined) {
      await this.settingsRepository.set("instance.description", metadata.description, updatedById);
      await this.invalidateCache("instance.description");
    }
    if (metadata.maintainerEmail !== undefined) {
      await this.settingsRepository.set(
        "instance.maintainerEmail",
        metadata.maintainerEmail,
        updatedById,
      );
      await this.invalidateCache("instance.maintainerEmail");
    }
    if (metadata.iconUrl !== undefined) {
      await this.setIconUrl(metadata.iconUrl, updatedById);
    }
    if (metadata.darkIconUrl !== undefined) {
      await this.setDarkIconUrl(metadata.darkIconUrl, updatedById);
    }
    if (metadata.bannerUrl !== undefined) {
      await this.setBannerUrl(metadata.bannerUrl, updatedById);
    }
    if (metadata.faviconUrl !== undefined) {
      await this.setFaviconUrl(metadata.faviconUrl, updatedById);
    }
    if (metadata.pwaIcon192Url !== undefined) {
      await this.setPwaIcon192Url(metadata.pwaIcon192Url, updatedById);
    }
    if (metadata.pwaIcon512Url !== undefined) {
      await this.setPwaIcon512Url(metadata.pwaIcon512Url, updatedById);
    }
    if (metadata.pwaMaskableIcon192Url !== undefined) {
      await this.setPwaMaskableIcon192Url(metadata.pwaMaskableIcon192Url, updatedById);
    }
    if (metadata.pwaMaskableIcon512Url !== undefined) {
      await this.setPwaMaskableIcon512Url(metadata.pwaMaskableIcon512Url, updatedById);
    }
    if (metadata.tosUrl !== undefined) {
      await this.setTosUrl(metadata.tosUrl, updatedById);
    }
    if (metadata.privacyPolicyUrl !== undefined) {
      await this.setPrivacyPolicyUrl(metadata.privacyPolicyUrl, updatedById);
    }
    if (metadata.sourceCodeUrl !== undefined) {
      await this.setSourceCodeUrl(metadata.sourceCodeUrl, updatedById);
    }
  }

  // ================================
  // Theme Settings
  // ================================

  /**
   * Get theme primary color (hex format)
   */
  async getPrimaryColor(): Promise<string> {
    return this.getCachedValue("theme.primaryColor", DEFAULT_THEME.primaryColor);
  }

  /**
   * Set theme primary color
   */
  async setPrimaryColor(color: string, updatedById?: string): Promise<void> {
    await this.settingsRepository.set("theme.primaryColor", color, updatedById);
    await this.invalidateCache("theme.primaryColor");
  }

  /**
   * Get dark mode preference
   */
  async getDarkMode(): Promise<"light" | "dark" | "system"> {
    const value = await this.getCachedValue<string>("theme.darkMode", DEFAULT_THEME.darkMode);
    return value as "light" | "dark" | "system";
  }

  /**
   * Set dark mode preference
   */
  async setDarkMode(mode: "light" | "dark" | "system", updatedById?: string): Promise<void> {
    await this.settingsRepository.set("theme.darkMode", mode, updatedById);
    await this.invalidateCache("theme.darkMode");
  }

  /**
   * Get NodeInfo theme color (for external services like Misskey)
   * Falls back to primaryColor if not set
   */
  async getNodeInfoThemeColor(): Promise<string | null> {
    return this.getCachedValue<string | null>(
      "theme.nodeInfoThemeColor",
      DEFAULT_THEME.nodeInfoThemeColor,
    );
  }

  /**
   * Set NodeInfo theme color
   * @param color - Hex color code or null to use primaryColor
   */
  async setNodeInfoThemeColor(color: string | null, updatedById?: string): Promise<void> {
    if (color === null) {
      await this.settingsRepository.delete("theme.nodeInfoThemeColor");
    } else {
      await this.settingsRepository.set("theme.nodeInfoThemeColor", color, updatedById);
    }
    await this.invalidateCache("theme.nodeInfoThemeColor");
  }

  /**
   * Get all theme settings
   */
  async getThemeSettings(): Promise<ThemeSettings> {
    const cacheKey = `${CachePrefix.INSTANCE_SETTINGS}:theme`;

    // Try cache first
    if (this.cacheService?.isAvailable()) {
      const cached = await this.cacheService.get<ThemeSettings>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const keys: InstanceSettingKey[] = [
      "theme.primaryColor",
      "theme.darkMode",
      "theme.nodeInfoThemeColor",
    ];
    const values = await this.settingsRepository.getMany(keys);

    const result: ThemeSettings = {
      primaryColor: (values.get("theme.primaryColor") as string) ?? DEFAULT_THEME.primaryColor,
      darkMode:
        (values.get("theme.darkMode") as "light" | "dark" | "system") ?? DEFAULT_THEME.darkMode,
      nodeInfoThemeColor:
        (values.get("theme.nodeInfoThemeColor") as string | null) ??
        DEFAULT_THEME.nodeInfoThemeColor,
    };

    // Cache the result
    if (this.cacheService?.isAvailable()) {
      await this.cacheService.set(cacheKey, result, { ttl: CacheTTL.LONG });
    }

    return result;
  }

  /**
   * Update theme settings
   */
  async updateThemeSettings(settings: Partial<ThemeSettings>, updatedById?: string): Promise<void> {
    if (settings.primaryColor !== undefined) {
      await this.settingsRepository.set("theme.primaryColor", settings.primaryColor, updatedById);
      await this.invalidateCache("theme.primaryColor");
    }
    if (settings.darkMode !== undefined) {
      await this.settingsRepository.set("theme.darkMode", settings.darkMode, updatedById);
      await this.invalidateCache("theme.darkMode");
    }
    if (settings.nodeInfoThemeColor !== undefined) {
      await this.setNodeInfoThemeColor(settings.nodeInfoThemeColor, updatedById);
    }
  }

  // ================================
  // Public API for NodeInfo / Instance Info
  // ================================

  /**
   * Public instance info type
   */
  private publicInstanceInfoType(): {
    name: string;
    description: string;
    maintainerEmail: string;
    iconUrl: string | null;
    darkIconUrl: string | null;
    bannerUrl: string | null;
    faviconUrl: string | null;
    tosUrl: string | null;
    privacyPolicyUrl: string | null;
    sourceCodeUrl: string | null;
    registrationEnabled: boolean;
    inviteOnly: boolean;
    approvalRequired: boolean;
    theme: ThemeSettings;
  } {
    // Just for TypeScript type inference
    return {} as never;
  }

  /**
   * Get public instance information for NodeInfo and API responses
   */
  async getPublicInstanceInfo(): Promise<ReturnType<typeof this.publicInstanceInfoType>> {
    const cacheKey = `${CachePrefix.INSTANCE_SETTINGS}:public`;

    // Try cache first
    if (this.cacheService?.isAvailable()) {
      const cached =
        await this.cacheService.get<ReturnType<typeof this.publicInstanceInfoType>>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const [metadata, registration, theme] = await Promise.all([
      this.getInstanceMetadata(),
      this.getRegistrationSettings(),
      this.getThemeSettings(),
    ]);

    const result = {
      ...metadata,
      registrationEnabled: registration.enabled,
      inviteOnly: registration.inviteOnly,
      approvalRequired: registration.approvalRequired,
      theme,
    };

    // Cache the result
    if (this.cacheService?.isAvailable()) {
      await this.cacheService.set(cacheKey, result, { ttl: CacheTTL.LONG });
    }

    return result;
  }


  // ================================
  // Onboarding Settings
  // ================================

  /**
   * Check if onboarding has been completed
   */
  async isOnboardingCompleted(): Promise<boolean> {
    return this.getCachedValue("onboarding.completed", false);
  }

  /**
   * Mark onboarding as completed
   */
  async setOnboardingCompleted(completed: boolean, updatedById?: string): Promise<void> {
    await this.settingsRepository.set("onboarding.completed", completed, updatedById);
    await this.invalidateCache("onboarding.completed");
  }
}

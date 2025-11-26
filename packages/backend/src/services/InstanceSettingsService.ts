/**
 * InstanceSettingsService
 *
 * Service for managing instance-wide settings stored in the database.
 * Provides typed accessors for common settings.
 */

import type {
  IInstanceSettingsRepository,
  InstanceSettingKey,
} from '../interfaces/repositories/IInstanceSettingsRepository.js';

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
  bannerUrl: string | null;
  tosUrl: string | null;
  privacyPolicyUrl: string | null;
}

/**
 * Theme settings
 */
export interface ThemeSettings {
  primaryColor: string;
  darkMode: 'light' | 'dark' | 'system';
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
  name: 'Rox Instance',
  description: 'A lightweight ActivityPub server',
  maintainerEmail: '',
  iconUrl: null,
  bannerUrl: null,
  tosUrl: null,
  privacyPolicyUrl: null,
};

/**
 * Default theme settings
 * Primary color is in OKLCH format hue value (0-360)
 */
const DEFAULT_THEME: ThemeSettings = {
  primaryColor: '#3b82f6', // Blue as default
  darkMode: 'system',
};

export class InstanceSettingsService {
  private readonly settingsRepository: IInstanceSettingsRepository;

  constructor(settingsRepository: IInstanceSettingsRepository) {
    this.settingsRepository = settingsRepository;
  }

  // ================================
  // Registration Settings
  // ================================

  /**
   * Check if user registration is enabled
   */
  async isRegistrationEnabled(): Promise<boolean> {
    const value = await this.settingsRepository.get<boolean>('registration.enabled');
    return value ?? DEFAULT_REGISTRATION.enabled;
  }

  /**
   * Set registration enabled/disabled
   */
  async setRegistrationEnabled(enabled: boolean, updatedById?: string): Promise<void> {
    await this.settingsRepository.set('registration.enabled', enabled, updatedById);
  }

  /**
   * Check if registration requires an invitation code
   */
  async isInviteOnly(): Promise<boolean> {
    const value = await this.settingsRepository.get<boolean>('registration.inviteOnly');
    return value ?? DEFAULT_REGISTRATION.inviteOnly;
  }

  /**
   * Set invite-only mode
   */
  async setInviteOnly(inviteOnly: boolean, updatedById?: string): Promise<void> {
    await this.settingsRepository.set('registration.inviteOnly', inviteOnly, updatedById);
  }

  /**
   * Check if registration requires admin approval
   */
  async isApprovalRequired(): Promise<boolean> {
    const value = await this.settingsRepository.get<boolean>('registration.approvalRequired');
    return value ?? DEFAULT_REGISTRATION.approvalRequired;
  }

  /**
   * Set approval-required mode
   */
  async setApprovalRequired(required: boolean, updatedById?: string): Promise<void> {
    await this.settingsRepository.set('registration.approvalRequired', required, updatedById);
  }

  /**
   * Get all registration settings
   */
  async getRegistrationSettings(): Promise<RegistrationSettings> {
    const keys: InstanceSettingKey[] = [
      'registration.enabled',
      'registration.inviteOnly',
      'registration.approvalRequired',
    ];
    const values = await this.settingsRepository.getMany(keys);

    return {
      enabled: (values.get('registration.enabled') as boolean) ?? DEFAULT_REGISTRATION.enabled,
      inviteOnly:
        (values.get('registration.inviteOnly') as boolean) ?? DEFAULT_REGISTRATION.inviteOnly,
      approvalRequired:
        (values.get('registration.approvalRequired') as boolean) ??
        DEFAULT_REGISTRATION.approvalRequired,
    };
  }

  /**
   * Update multiple registration settings at once
   */
  async updateRegistrationSettings(
    settings: Partial<RegistrationSettings>,
    updatedById?: string
  ): Promise<void> {
    const updates: Array<{ key: InstanceSettingKey; value: boolean }> = [];

    if (settings.enabled !== undefined) {
      updates.push({ key: 'registration.enabled', value: settings.enabled });
    }
    if (settings.inviteOnly !== undefined) {
      updates.push({ key: 'registration.inviteOnly', value: settings.inviteOnly });
    }
    if (settings.approvalRequired !== undefined) {
      updates.push({ key: 'registration.approvalRequired', value: settings.approvalRequired });
    }

    for (const { key, value } of updates) {
      await this.settingsRepository.set(key, value, updatedById);
    }
  }

  // ================================
  // Instance Metadata
  // ================================

  /**
   * Get instance name
   */
  async getInstanceName(): Promise<string> {
    const value = await this.settingsRepository.get<string>('instance.name');
    return value ?? DEFAULT_METADATA.name;
  }

  /**
   * Set instance name
   */
  async setInstanceName(name: string, updatedById?: string): Promise<void> {
    await this.settingsRepository.set('instance.name', name, updatedById);
  }

  /**
   * Get instance description
   */
  async getInstanceDescription(): Promise<string> {
    const value = await this.settingsRepository.get<string>('instance.description');
    return value ?? DEFAULT_METADATA.description;
  }

  /**
   * Set instance description
   */
  async setInstanceDescription(description: string, updatedById?: string): Promise<void> {
    await this.settingsRepository.set('instance.description', description, updatedById);
  }

  /**
   * Get maintainer email
   */
  async getMaintainerEmail(): Promise<string> {
    const value = await this.settingsRepository.get<string>('instance.maintainerEmail');
    return value ?? DEFAULT_METADATA.maintainerEmail;
  }

  /**
   * Set maintainer email
   */
  async setMaintainerEmail(email: string, updatedById?: string): Promise<void> {
    await this.settingsRepository.set('instance.maintainerEmail', email, updatedById);
  }

  /**
   * Get instance icon URL
   */
  async getIconUrl(): Promise<string | null> {
    const value = await this.settingsRepository.get<string>('instance.iconUrl');
    return value ?? DEFAULT_METADATA.iconUrl;
  }

  /**
   * Set instance icon URL
   */
  async setIconUrl(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete('instance.iconUrl');
    } else {
      await this.settingsRepository.set('instance.iconUrl', url, updatedById);
    }
  }

  /**
   * Get instance banner URL
   */
  async getBannerUrl(): Promise<string | null> {
    const value = await this.settingsRepository.get<string>('instance.bannerUrl');
    return value ?? DEFAULT_METADATA.bannerUrl;
  }

  /**
   * Set instance banner URL
   */
  async setBannerUrl(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete('instance.bannerUrl');
    } else {
      await this.settingsRepository.set('instance.bannerUrl', url, updatedById);
    }
  }

  /**
   * Get Terms of Service URL
   */
  async getTosUrl(): Promise<string | null> {
    const value = await this.settingsRepository.get<string>('instance.tosUrl');
    return value ?? DEFAULT_METADATA.tosUrl;
  }

  /**
   * Set Terms of Service URL
   */
  async setTosUrl(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete('instance.tosUrl');
    } else {
      await this.settingsRepository.set('instance.tosUrl', url, updatedById);
    }
  }

  /**
   * Get Privacy Policy URL
   */
  async getPrivacyPolicyUrl(): Promise<string | null> {
    const value = await this.settingsRepository.get<string>('instance.privacyPolicyUrl');
    return value ?? DEFAULT_METADATA.privacyPolicyUrl;
  }

  /**
   * Set Privacy Policy URL
   */
  async setPrivacyPolicyUrl(url: string | null, updatedById?: string): Promise<void> {
    if (url === null) {
      await this.settingsRepository.delete('instance.privacyPolicyUrl');
    } else {
      await this.settingsRepository.set('instance.privacyPolicyUrl', url, updatedById);
    }
  }

  /**
   * Get all instance metadata
   */
  async getInstanceMetadata(): Promise<InstanceMetadata> {
    const keys: InstanceSettingKey[] = [
      'instance.name',
      'instance.description',
      'instance.maintainerEmail',
      'instance.iconUrl',
      'instance.bannerUrl',
      'instance.tosUrl',
      'instance.privacyPolicyUrl',
    ];
    const values = await this.settingsRepository.getMany(keys);

    return {
      name: (values.get('instance.name') as string) ?? DEFAULT_METADATA.name,
      description: (values.get('instance.description') as string) ?? DEFAULT_METADATA.description,
      maintainerEmail:
        (values.get('instance.maintainerEmail') as string) ?? DEFAULT_METADATA.maintainerEmail,
      iconUrl: (values.get('instance.iconUrl') as string | null) ?? DEFAULT_METADATA.iconUrl,
      bannerUrl: (values.get('instance.bannerUrl') as string | null) ?? DEFAULT_METADATA.bannerUrl,
      tosUrl: (values.get('instance.tosUrl') as string | null) ?? DEFAULT_METADATA.tosUrl,
      privacyPolicyUrl:
        (values.get('instance.privacyPolicyUrl') as string | null) ??
        DEFAULT_METADATA.privacyPolicyUrl,
    };
  }

  /**
   * Update multiple metadata settings at once
   */
  async updateInstanceMetadata(
    metadata: Partial<InstanceMetadata>,
    updatedById?: string
  ): Promise<void> {
    if (metadata.name !== undefined) {
      await this.settingsRepository.set('instance.name', metadata.name, updatedById);
    }
    if (metadata.description !== undefined) {
      await this.settingsRepository.set('instance.description', metadata.description, updatedById);
    }
    if (metadata.maintainerEmail !== undefined) {
      await this.settingsRepository.set(
        'instance.maintainerEmail',
        metadata.maintainerEmail,
        updatedById
      );
    }
    if (metadata.iconUrl !== undefined) {
      await this.setIconUrl(metadata.iconUrl, updatedById);
    }
    if (metadata.bannerUrl !== undefined) {
      await this.setBannerUrl(metadata.bannerUrl, updatedById);
    }
    if (metadata.tosUrl !== undefined) {
      await this.setTosUrl(metadata.tosUrl, updatedById);
    }
    if (metadata.privacyPolicyUrl !== undefined) {
      await this.setPrivacyPolicyUrl(metadata.privacyPolicyUrl, updatedById);
    }
  }

  // ================================
  // Theme Settings
  // ================================

  /**
   * Get theme primary color (hex format)
   */
  async getPrimaryColor(): Promise<string> {
    const value = await this.settingsRepository.get<string>('theme.primaryColor');
    return value ?? DEFAULT_THEME.primaryColor;
  }

  /**
   * Set theme primary color
   */
  async setPrimaryColor(color: string, updatedById?: string): Promise<void> {
    await this.settingsRepository.set('theme.primaryColor', color, updatedById);
  }

  /**
   * Get dark mode preference
   */
  async getDarkMode(): Promise<'light' | 'dark' | 'system'> {
    const value = await this.settingsRepository.get<string>('theme.darkMode');
    return (value as 'light' | 'dark' | 'system') ?? DEFAULT_THEME.darkMode;
  }

  /**
   * Set dark mode preference
   */
  async setDarkMode(mode: 'light' | 'dark' | 'system', updatedById?: string): Promise<void> {
    await this.settingsRepository.set('theme.darkMode', mode, updatedById);
  }

  /**
   * Get all theme settings
   */
  async getThemeSettings(): Promise<ThemeSettings> {
    const keys: InstanceSettingKey[] = ['theme.primaryColor', 'theme.darkMode'];
    const values = await this.settingsRepository.getMany(keys);

    return {
      primaryColor: (values.get('theme.primaryColor') as string) ?? DEFAULT_THEME.primaryColor,
      darkMode: (values.get('theme.darkMode') as 'light' | 'dark' | 'system') ?? DEFAULT_THEME.darkMode,
    };
  }

  /**
   * Update theme settings
   */
  async updateThemeSettings(
    settings: Partial<ThemeSettings>,
    updatedById?: string
  ): Promise<void> {
    if (settings.primaryColor !== undefined) {
      await this.settingsRepository.set('theme.primaryColor', settings.primaryColor, updatedById);
    }
    if (settings.darkMode !== undefined) {
      await this.settingsRepository.set('theme.darkMode', settings.darkMode, updatedById);
    }
  }

  // ================================
  // Public API for NodeInfo / Instance Info
  // ================================

  /**
   * Get public instance information for NodeInfo and API responses
   */
  async getPublicInstanceInfo(): Promise<{
    name: string;
    description: string;
    maintainerEmail: string;
    iconUrl: string | null;
    bannerUrl: string | null;
    tosUrl: string | null;
    privacyPolicyUrl: string | null;
    registrationEnabled: boolean;
    inviteOnly: boolean;
    approvalRequired: boolean;
    theme: ThemeSettings;
  }> {
    const [metadata, registration, theme] = await Promise.all([
      this.getInstanceMetadata(),
      this.getRegistrationSettings(),
      this.getThemeSettings(),
    ]);

    return {
      ...metadata,
      registrationEnabled: registration.enabled,
      inviteOnly: registration.inviteOnly,
      approvalRequired: registration.approvalRequired,
      theme,
    };
  }
}

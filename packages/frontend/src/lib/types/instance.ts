/**
 * Instance Information Types
 *
 * Types for instance metadata, registration settings, and theme configuration
 */

/**
 * Theme settings for the instance
 */
export interface ThemeSettings {
  primaryColor: string;
  darkMode: 'light' | 'dark' | 'system';
}

/**
 * Registration settings
 */
export interface RegistrationSettings {
  enabled: boolean;
  inviteOnly: boolean;
  approvalRequired: boolean;
}

/**
 * Software information
 */
export interface SoftwareInfo {
  name: string;
  version: string;
  repository: string;
}

/**
 * Public instance information returned by /api/instance
 */
export interface InstanceInfo {
  name: string;
  description: string;
  url: string;
  maintainerEmail: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  tosUrl: string | null;
  privacyPolicyUrl: string | null;
  registration: RegistrationSettings;
  theme: ThemeSettings;
  software: SoftwareInfo;
}

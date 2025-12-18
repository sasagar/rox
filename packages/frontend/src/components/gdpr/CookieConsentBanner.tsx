"use client";

/**
 * Cookie Consent Banner Component
 *
 * Displays a banner to request user consent for cookies.
 * Implements GDPR Article 7 (Conditions for consent) and ePrivacy Directive.
 *
 * This banner only appears for first-time visitors or when consent expires.
 * Users can accept all, reject non-essential, or customize their preferences.
 *
 * @module components/gdpr/CookieConsentBanner
 */

import { useState, useEffect, useCallback } from "react";
import { Trans } from "@lingui/react/macro";
import { Cookie, X, Settings, Check } from "lucide-react";
import { Button } from "../ui/Button";
import { SpaLink } from "../ui/SpaLink";
import { Switch } from "../ui/Switch";

/**
 * Cookie consent preferences
 */
export interface CookieConsent {
  /** Essential cookies (always required) */
  essential: boolean;
  /** Functional cookies (preferences, settings) */
  functional: boolean;
  /** Analytics cookies (usage statistics) */
  analytics: boolean;
  /** Timestamp when consent was given */
  timestamp: number;
}

const CONSENT_KEY = "cookie-consent";
const CONSENT_EXPIRY_DAYS = 365;

/**
 * Get stored cookie consent
 */
function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;

    const consent = JSON.parse(stored) as CookieConsent;

    // Check if consent has expired
    const expiryMs = CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - consent.timestamp > expiryMs) {
      localStorage.removeItem(CONSENT_KEY);
      return null;
    }

    return consent;
  } catch {
    return null;
  }
}

/**
 * Save cookie consent
 */
function saveConsent(consent: CookieConsent): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
}

/**
 * Cookie Consent Banner
 *
 * Shows a GDPR-compliant cookie consent banner at the bottom of the page.
 * Essential cookies are always enabled as they're required for the service.
 */
export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState({
    functional: true,
    analytics: false,
  });

  // Check for existing consent on mount
  useEffect(() => {
    const consent = getStoredConsent();
    if (consent) return;

    // Small delay to avoid flash on page load
    const timer = setTimeout(() => setIsVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleAcceptAll = useCallback(() => {
    const consent: CookieConsent = {
      essential: true,
      functional: true,
      analytics: true,
      timestamp: Date.now(),
    };
    saveConsent(consent);
    setIsVisible(false);
  }, []);

  const handleRejectNonEssential = useCallback(() => {
    const consent: CookieConsent = {
      essential: true,
      functional: false,
      analytics: false,
      timestamp: Date.now(),
    };
    saveConsent(consent);
    setIsVisible(false);
  }, []);

  const handleSavePreferences = useCallback(() => {
    const consent: CookieConsent = {
      essential: true,
      functional: preferences.functional,
      analytics: preferences.analytics,
      timestamp: Date.now(),
    };
    saveConsent(consent);
    setIsVisible(false);
  }, [preferences]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 bg-(--card-bg) border-t border-(--border-color) shadow-lg">
      <div className="max-w-4xl mx-auto">
        {!showDetails ? (
          // Simple banner
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Cookie className="w-6 h-6 text-primary-500 shrink-0 mt-0.5" />
              <div className="text-sm text-(--text-secondary)">
                <p className="mb-1">
                  <Trans>
                    We use cookies to improve your experience. Essential cookies are required for the
                    service to function. You can customize your preferences or accept all cookies.
                  </Trans>
                </p>
                <SpaLink
                  to="/legal/privacy#cookies"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  <Trans>Learn more about our cookie policy</Trans>
                </SpaLink>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setShowDetails(true)}
              >
                <Settings className="w-4 h-4 mr-1" />
                <Trans>Customize</Trans>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onPress={handleRejectNonEssential}
              >
                <Trans>Essential only</Trans>
              </Button>
              <Button size="sm" onPress={handleAcceptAll}>
                <Check className="w-4 h-4 mr-1" />
                <Trans>Accept all</Trans>
              </Button>
            </div>
          </div>
        ) : (
          // Detailed preferences
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-(--text-primary) flex items-center gap-2">
                <Cookie className="w-5 h-5" />
                <Trans>Cookie Preferences</Trans>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setShowDetails(false)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-3">
              {/* Essential cookies */}
              <div className="flex items-center justify-between p-3 bg-(--bg-secondary) rounded-lg">
                <div>
                  <p className="font-medium text-(--text-primary)">
                    <Trans>Essential Cookies</Trans>
                  </p>
                  <p className="text-sm text-(--text-muted)">
                    <Trans>
                      Required for the website to function. These cannot be disabled.
                    </Trans>
                  </p>
                </div>
                <div className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                  <Trans>Required</Trans>
                </div>
              </div>

              {/* Functional cookies */}
              <div className="flex items-center justify-between p-3 bg-(--bg-secondary) rounded-lg">
                <div>
                  <p className="font-medium text-(--text-primary)">
                    <Trans>Functional Cookies</Trans>
                  </p>
                  <p className="text-sm text-(--text-muted)">
                    <Trans>
                      Remember your preferences and settings for a better experience.
                    </Trans>
                  </p>
                </div>
                <Switch
                  isSelected={preferences.functional}
                  onChange={(isSelected) =>
                    setPreferences((p) => ({ ...p, functional: isSelected }))
                  }
                  aria-label="Functional Cookies"
                />
              </div>

              {/* Analytics cookies */}
              <div className="flex items-center justify-between p-3 bg-(--bg-secondary) rounded-lg">
                <div>
                  <p className="font-medium text-(--text-primary)">
                    <Trans>Analytics Cookies</Trans>
                  </p>
                  <p className="text-sm text-(--text-muted)">
                    <Trans>
                      Help us understand how you use the service to improve it.
                    </Trans>
                  </p>
                </div>
                <Switch
                  isSelected={preferences.analytics}
                  onChange={(isSelected) =>
                    setPreferences((p) => ({ ...p, analytics: isSelected }))
                  }
                  aria-label="Analytics Cookies"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onPress={handleRejectNonEssential}>
                <Trans>Reject all optional</Trans>
              </Button>
              <Button size="sm" onPress={handleSavePreferences}>
                <Trans>Save preferences</Trans>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to get current cookie consent status
 */
export function useCookieConsent(): CookieConsent | null {
  const [consent, setConsent] = useState<CookieConsent | null>(null);

  useEffect(() => {
    setConsent(getStoredConsent());

    // Listen for storage changes (consent updated in another tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY) {
        setConsent(getStoredConsent());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return consent;
}

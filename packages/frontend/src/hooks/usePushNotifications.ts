"use client";

/**
 * Push notifications hook
 *
 * Manages Web Push subscription state and operations
 */

import { useState, useEffect, useCallback } from "react";
import { useAtomValue } from "jotai";
import { isAuthenticatedAtom } from "../lib/atoms/auth";
import { pushApi, urlBase64ToUint8Array } from "../lib/api/push";
import type { PushSubscriptionInfo } from "../lib/api/push";

/**
 * Push notification permission state
 */
export type PushPermissionState = "prompt" | "granted" | "denied" | "unsupported";

/**
 * Push notification hook state
 */
export interface UsePushNotificationsState {
  /** Whether Web Push is supported by the browser */
  isSupported: boolean;
  /** Whether Web Push is available on the server */
  isAvailable: boolean;
  /** Current permission state */
  permission: PushPermissionState;
  /** Whether user is subscribed */
  isSubscribed: boolean;
  /** List of user's subscriptions */
  subscriptions: PushSubscriptionInfo[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
}

/**
 * Push notification hook actions
 */
export interface UsePushNotificationsActions {
  /** Subscribe to push notifications */
  subscribe: () => Promise<boolean>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>;
  /** Refresh subscription state */
  refresh: () => Promise<void>;
  /** Send test notification */
  sendTest: () => Promise<boolean>;
}

/**
 * Check if push notifications are supported
 */
function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Get current notification permission
 */
function getPermission(): PushPermissionState {
  if (!isPushSupported()) {
    return "unsupported";
  }
  return Notification.permission as PushPermissionState;
}

/**
 * Hook for managing push notifications
 */
export function usePushNotifications(): UsePushNotificationsState & UsePushNotificationsActions {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  const [isSupported] = useState(isPushSupported);
  const [isAvailable, setIsAvailable] = useState(false);
  const [permission, setPermission] = useState<PushPermissionState>(getPermission);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptions, setSubscriptions] = useState<PushSubscriptionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  /**
   * Check server availability and get VAPID key
   */
  const checkAvailability = useCallback(async () => {
    try {
      const status = await pushApi.getStatus();
      setIsAvailable(status.available);
      setVapidPublicKey(status.publicKey);
    } catch (err) {
      console.error("Failed to check push availability:", err);
      setIsAvailable(false);
    }
  }, []);

  /**
   * Get current subscription from browser
   */
  const getCurrentSubscription = useCallback(async (): Promise<PushSubscription | null> => {
    if (!isSupported) return null;

    try {
      // Check if there's an active service worker registration
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        // No service worker registered yet
        return null;
      }
      return registration.pushManager.getSubscription();
    } catch (err) {
      console.error("Failed to get subscription:", err);
      return null;
    }
  }, [isSupported]);

  /**
   * Refresh subscription state
   */
  const refresh = useCallback(async () => {
    if (!isAuthenticated || !isSupported) return;

    setLoading(true);
    setError(null);

    try {
      // Check server availability
      await checkAvailability();

      // Get browser subscription
      const subscription = await getCurrentSubscription();
      setIsSubscribed(!!subscription);

      // Get all user subscriptions from server
      const { subscriptions: subs } = await pushApi.getSubscriptions();
      setSubscriptions(subs);
    } catch (err) {
      console.error("Failed to refresh push state:", err);
      setError("Failed to load push notification status");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isSupported, checkAvailability, getCurrentSubscription]);

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !isAvailable || !vapidPublicKey) {
      setError("Push notifications are not available");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult as PushPermissionState);

      if (permissionResult !== "granted") {
        setError("Notification permission denied");
        return false;
      }

      // Register service worker if not already
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      });

      // Get user's preferred language from localStorage
      const language = typeof localStorage !== "undefined" ? localStorage.getItem("locale") || undefined : undefined;

      // Send subscription to server
      const result = await pushApi.subscribe(subscription, language);

      if (result.success) {
        setIsSubscribed(true);
        await refresh();
        return true;
      } else {
        setError("Failed to register subscription");
        return false;
      }
    } catch (err: any) {
      console.error("Failed to subscribe:", err);
      setError(err.message || "Failed to subscribe to notifications");
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, isAvailable, vapidPublicKey, refresh]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setLoading(true);
    setError(null);

    try {
      const subscription = await getCurrentSubscription();

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Unsubscribe from server
        await pushApi.unsubscribe(subscription.endpoint);
      }

      setIsSubscribed(false);
      await refresh();
      return true;
    } catch (err: any) {
      console.error("Failed to unsubscribe:", err);
      setError(err.message || "Failed to unsubscribe");
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, getCurrentSubscription, refresh]);

  /**
   * Send test notification
   */
  const sendTest = useCallback(async (): Promise<boolean> => {
    if (!isSubscribed) {
      setError("You must be subscribed to send a test notification");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await pushApi.sendTest();
      return result.success;
    } catch (err: any) {
      console.error("Failed to send test:", err);
      setError(err.message || "Failed to send test notification");
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSubscribed]);

  // Initialize on mount
  useEffect(() => {
    if (isAuthenticated && isSupported) {
      refresh();
    }
  }, [isAuthenticated, isSupported, refresh]);

  // Update permission on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setPermission(getPermission());
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return {
    isSupported,
    isAvailable,
    permission,
    isSubscribed,
    subscriptions,
    loading,
    error,
    subscribe,
    unsubscribe,
    refresh,
    sendTest,
  };
}

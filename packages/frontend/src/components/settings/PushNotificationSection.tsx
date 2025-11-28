'use client';

/**
 * Push Notification Settings Section
 *
 * Allows users to manage push notification subscriptions
 */

import { Trans } from '@lingui/react/macro';
import { Bell, BellOff, Smartphone, Send, AlertCircle, Check } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Spinner } from '../ui/Spinner';

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get device name from user agent
 */
function getDeviceName(userAgent?: string): string {
  if (!userAgent) return 'Unknown device';

  if (userAgent.includes('Mobile')) {
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) return 'Android';
    return 'Mobile';
  }
  if (userAgent.includes('Mac')) return 'Mac';
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Linux')) return 'Linux';

  return 'Browser';
}

export function PushNotificationSection() {
  const {
    isSupported,
    isAvailable,
    permission,
    isSubscribed,
    subscriptions,
    loading,
    error,
    subscribe,
    unsubscribe,
    sendTest,
  } = usePushNotifications();

  // Not supported by browser
  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <Trans>Push Notifications</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              <Trans>Your browser does not support push notifications.</Trans>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not available on server
  if (!isAvailable && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <Trans>Push Notifications</Trans>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              <Trans>Push notifications are not configured on this server.</Trans>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          <Trans>Push Notifications</Trans>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Permission denied warning */}
        {permission === 'denied' && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">
                <Trans>Notifications are blocked</Trans>
              </p>
              <p className="mt-1">
                <Trans>
                  Please enable notifications in your browser settings to receive push notifications.
                </Trans>
              </p>
            </div>
          </div>
        )}

        {/* Subscription status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isSubscribed ? (
              <>
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-(--text-primary)">
                    <Trans>Push notifications enabled</Trans>
                  </p>
                  <p className="text-sm text-(--text-muted)">
                    <Trans>You will receive notifications even when the browser is closed.</Trans>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <BellOff className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-(--text-primary)">
                    <Trans>Push notifications disabled</Trans>
                  </p>
                  <p className="text-sm text-(--text-muted)">
                    <Trans>Enable to receive notifications in the background.</Trans>
                  </p>
                </div>
              </>
            )}
          </div>

          <Button
            onPress={isSubscribed ? unsubscribe : subscribe}
            isDisabled={loading || permission === 'denied'}
            variant={isSubscribed ? 'secondary' : 'primary'}
          >
            {loading ? (
              <Spinner size="sm" />
            ) : isSubscribed ? (
              <Trans>Disable</Trans>
            ) : (
              <Trans>Enable</Trans>
            )}
          </Button>
        </div>

        {/* Test notification button */}
        {isSubscribed && (
          <div className="pt-4 border-t border-(--border-color)">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-(--text-primary)">
                  <Trans>Test notification</Trans>
                </p>
                <p className="text-sm text-(--text-muted)">
                  <Trans>Send a test notification to verify your setup.</Trans>
                </p>
              </div>
              <Button onPress={sendTest} isDisabled={loading} variant="secondary" size="sm">
                {loading ? <Spinner size="sm" /> : <Send className="w-4 h-4" />}
                <span className="ml-2">
                  <Trans>Send test</Trans>
                </span>
              </Button>
            </div>
          </div>
        )}

        {/* Subscription list */}
        {subscriptions.length > 0 && (
          <div className="pt-4 border-t border-(--border-color)">
            <h4 className="text-sm font-medium text-(--text-primary) mb-3">
              <Trans>Registered devices</Trans>
            </h4>
            <ul className="space-y-2">
              {subscriptions.map((sub) => (
                <li
                  key={sub.id}
                  className="flex items-center justify-between p-3 bg-(--bg-secondary) rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-(--text-muted)" />
                    <div>
                      <p className="text-sm font-medium text-(--text-primary)">
                        {getDeviceName(sub.userAgent)}
                      </p>
                      <p className="text-xs text-(--text-muted)">{formatDate(sub.createdAt)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

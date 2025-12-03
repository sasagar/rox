/**
 * Notifications API client
 *
 * Provides methods for notification management
 */

import { apiClient } from "./client";
import type { Notification, NotificationFetchOptions } from "../types/notification";

export type { Notification, NotificationFetchOptions };

/**
 * Notifications API operations
 */
export const notificationsApi = {
  /**
   * Get notifications for the current user
   *
   * @param options - Fetch options
   * @returns List of notifications
   */
  async getNotifications(options: NotificationFetchOptions = {}): Promise<Notification[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set("limit", options.limit.toString());
    if (options.sinceId) params.set("sinceId", options.sinceId);
    if (options.untilId) params.set("untilId", options.untilId);
    if (options.types?.length) params.set("types", options.types.join(","));
    if (options.unreadOnly) params.set("unreadOnly", "true");

    const query = params.toString();
    return apiClient.get<Notification[]>(`/api/notifications${query ? `?${query}` : ""}`);
  },

  /**
   * Get unread notification count
   *
   * @returns Unread count
   */
  async getUnreadCount(): Promise<{ count: number }> {
    return apiClient.get<{ count: number }>("/api/notifications/unread-count");
  },

  /**
   * Mark a notification as read
   *
   * @param notificationId - Notification ID
   * @returns Updated notification
   */
  async markAsRead(notificationId: string): Promise<Notification> {
    return apiClient.post<Notification>("/api/notifications/mark-as-read", { notificationId });
  },

  /**
   * Mark all notifications as read
   *
   * @returns Number of marked notifications
   */
  async markAllAsRead(): Promise<{ count: number }> {
    return apiClient.post<{ count: number }>("/api/notifications/mark-all-as-read");
  },

  /**
   * Mark notifications as read up to a specific ID
   *
   * @param untilId - Notification ID
   * @returns Number of marked notifications
   */
  async markAsReadUntil(untilId: string): Promise<{ count: number }> {
    return apiClient.post<{ count: number }>("/api/notifications/mark-as-read-until", { untilId });
  },

  /**
   * Delete a notification
   *
   * @param notificationId - Notification ID
   */
  async deleteNotification(notificationId: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>("/api/notifications/delete", { notificationId });
  },

  /**
   * Delete all notifications
   *
   * @returns Number of deleted notifications
   */
  async deleteAllNotifications(): Promise<{ count: number }> {
    return apiClient.post<{ count: number }>("/api/notifications/delete-all");
  },
};

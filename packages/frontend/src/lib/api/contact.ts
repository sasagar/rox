/**
 * Contact/Inquiry API Functions
 *
 * Functions for interacting with the contact/inquiry system.
 */

import { apiClient } from "./client";
import type {
  CreateContactThreadRequest,
  CreateContactThreadResponse,
  ListContactThreadsResponse,
  GetContactThreadResponse,
  GetContactThreadAdminResponse,
  ContactCategoryOption,
} from "shared";

/**
 * Create a new contact thread
 */
export async function createContactThread(
  data: CreateContactThreadRequest,
): Promise<CreateContactThreadResponse> {
  return apiClient.post("/api/contact/threads", data);
}

/**
 * List user's contact threads
 */
export async function listContactThreads(params?: {
  limit?: number;
  offset?: number;
}): Promise<ListContactThreadsResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const queryString = query.toString();
  return apiClient.get(`/api/contact/threads${queryString ? `?${queryString}` : ""}`);
}

/**
 * Get a contact thread with messages
 */
export async function getContactThread(threadId: string): Promise<GetContactThreadResponse> {
  return apiClient.get(`/api/contact/threads/${threadId}`);
}

/**
 * Add a message to a thread
 */
export async function addContactMessage(
  threadId: string,
  message: string,
): Promise<{ id: string; content: string; createdAt: string }> {
  return apiClient.post(`/api/contact/threads/${threadId}/messages`, { message });
}

/**
 * Get unread count for user
 */
export async function getContactUnreadCount(): Promise<{ unreadCount: number }> {
  return apiClient.get("/api/contact/unread");
}

/**
 * Get contact categories
 */
export async function getContactCategories(): Promise<{ categories: ContactCategoryOption[] }> {
  return apiClient.get("/api/contact/categories");
}

// =============================================================================
// Admin API Functions
// =============================================================================

/**
 * List all contact threads (admin)
 */
export async function listContactThreadsAdmin(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<ListContactThreadsResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.status) query.set("status", params.status);
  if (params?.category) query.set("category", params.category);
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortOrder) query.set("sortOrder", params.sortOrder);

  const queryString = query.toString();
  return apiClient.get(`/api/contact/admin/threads${queryString ? `?${queryString}` : ""}`);
}

/**
 * Get a contact thread with messages (admin)
 */
export async function getContactThreadAdmin(
  threadId: string,
): Promise<GetContactThreadAdminResponse> {
  return apiClient.get(`/api/contact/admin/threads/${threadId}`);
}

/**
 * Reply to a thread (admin)
 */
export async function replyToContactThread(
  threadId: string,
  message: string,
): Promise<{ id: string; senderType: string; content: string; createdAt: string }> {
  return apiClient.post(`/api/contact/admin/threads/${threadId}/messages`, { message });
}

/**
 * Update thread status (admin)
 */
export async function updateContactThreadStatus(
  threadId: string,
  status: string,
): Promise<{ id: string; status: string; closedAt?: string }> {
  return apiClient.patch(`/api/contact/admin/threads/${threadId}/status`, { status });
}

/**
 * Update thread priority (admin)
 */
export async function updateContactThreadPriority(
  threadId: string,
  priority: number,
): Promise<{ id: string; priority: number }> {
  return apiClient.patch(`/api/contact/admin/threads/${threadId}/priority`, { priority });
}

/**
 * Update internal notes (admin)
 */
export async function updateContactThreadNotes(
  threadId: string,
  notes: string,
): Promise<{ id: string; internalNotes: string }> {
  return apiClient.patch(`/api/contact/admin/threads/${threadId}/notes`, { notes });
}

/**
 * Get unread count for staff (admin)
 */
export async function getContactUnreadCountAdmin(): Promise<{ unreadCount: number }> {
  return apiClient.get("/api/contact/admin/unread");
}

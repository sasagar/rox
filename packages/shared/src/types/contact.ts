/**
 * Contact/Inquiry Types
 *
 * Shared types for the contact/inquiry system.
 */

export type ContactThreadStatus = "open" | "in_progress" | "resolved" | "closed";
export type ContactSenderType = "user" | "admin" | "moderator";
export type ContactCategory =
  | "general"
  | "bug_report"
  | "feature_request"
  | "account"
  | "abuse"
  | "other";

/**
 * Contact thread summary for listing
 */
export interface ContactThreadSummary {
  id: string;
  subject: string;
  category: ContactCategory;
  status: ContactThreadStatus;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  messageCount: number;
  unreadCount: number;
}

/**
 * Contact thread with full details
 */
export interface ContactThread {
  id: string;
  subject: string;
  category: ContactCategory;
  status: ContactThreadStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Contact thread for admin view (includes additional fields)
 */
export interface ContactThreadAdmin extends ContactThread {
  userId?: string;
  user?: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  email?: string;
  priority: number;
  assignedToId?: string;
  internalNotes?: string;
  closedAt?: string;
}

/**
 * Contact message for user view (hides sender identity)
 */
export interface ContactMessage {
  id: string;
  senderType: ContactSenderType;
  senderLabel: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

/**
 * Contact message for admin view (includes sender ID)
 */
export interface ContactMessageAdmin {
  id: string;
  senderId?: string;
  senderType: ContactSenderType;
  content: string;
  createdAt: string;
  isRead: boolean;
}

/**
 * Create thread request
 */
export interface CreateContactThreadRequest {
  subject: string;
  category?: ContactCategory;
  message: string;
  email?: string;
}

/**
 * Create thread response
 */
export interface CreateContactThreadResponse {
  id: string;
  subject: string;
  category: ContactCategory;
  status: ContactThreadStatus;
  createdAt: string;
  message: string;
}

/**
 * List threads response
 */
export interface ListContactThreadsResponse {
  threads: ContactThreadSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Get thread response (user view)
 */
export interface GetContactThreadResponse {
  thread: ContactThread;
  messages: ContactMessage[];
}

/**
 * Get thread response (admin view)
 */
export interface GetContactThreadAdminResponse {
  thread: ContactThreadAdmin;
  messages: ContactMessageAdmin[];
}

/**
 * Category option for display
 */
export interface ContactCategoryOption {
  value: ContactCategory;
  label: string;
}

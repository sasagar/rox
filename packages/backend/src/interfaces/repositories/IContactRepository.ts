/**
 * Contact Repository Interface
 *
 * Handles contact/inquiry threads and messages for user support.
 */

import type {
  ContactThread,
  ContactMessage,
  ContactThreadStatus,
  ContactSenderType,
} from "../../db/schema/pg.js";

/**
 * Options for listing contact threads
 */
export interface ListContactThreadsOptions {
  /** Filter by status */
  status?: ContactThreadStatus;
  /** Filter by category */
  category?: string;
  /** Filter by assigned staff ID */
  assignedToId?: string;
  /** Filter by user ID (for user's own threads) */
  userId?: string;
  /** Pagination limit */
  limit?: number;
  /** Pagination offset */
  offset?: number;
  /** Sort order */
  sortBy?: "createdAt" | "updatedAt" | "priority";
  sortOrder?: "asc" | "desc";
}

/**
 * Create thread input
 */
export interface CreateThreadInput {
  id: string;
  userId?: string;
  subject: string;
  category?: string;
  email?: string;
}

/**
 * Create message input
 */
export interface CreateMessageInput {
  id: string;
  threadId: string;
  senderId?: string;
  senderType: ContactSenderType;
  content: string;
  attachmentIds?: string[];
}

/**
 * Thread with latest message info for listing
 */
export interface ContactThreadWithPreview extends ContactThread {
  /** Preview of the last message */
  lastMessagePreview?: string;
  /** When the last message was sent */
  lastMessageAt?: Date;
  /** Count of unread messages (for user or staff) */
  unreadCount?: number;
  /** Total message count */
  messageCount?: number;
}

export interface IContactRepository {
  // ============================================
  // Thread operations
  // ============================================

  /**
   * Create a new contact thread
   */
  createThread(input: CreateThreadInput): Promise<ContactThread>;

  /**
   * Get a thread by ID
   */
  findThreadById(id: string): Promise<ContactThread | null>;

  /**
   * List threads with filters and pagination
   */
  listThreads(options?: ListContactThreadsOptions): Promise<ContactThreadWithPreview[]>;

  /**
   * Count threads matching filters
   */
  countThreads(options?: Omit<ListContactThreadsOptions, "limit" | "offset" | "sortBy" | "sortOrder">): Promise<number>;

  /**
   * Update thread status
   */
  updateThreadStatus(id: string, status: ContactThreadStatus): Promise<ContactThread | null>;

  /**
   * Update thread assignment
   */
  assignThread(id: string, assignedToId: string | null): Promise<ContactThread | null>;

  /**
   * Update thread priority
   */
  updateThreadPriority(id: string, priority: number): Promise<ContactThread | null>;

  /**
   * Update internal notes (staff only)
   */
  updateInternalNotes(id: string, notes: string): Promise<ContactThread | null>;

  /**
   * Close a thread
   */
  closeThread(id: string): Promise<ContactThread | null>;

  // ============================================
  // Message operations
  // ============================================

  /**
   * Add a message to a thread
   */
  createMessage(input: CreateMessageInput): Promise<ContactMessage>;

  /**
   * Get messages for a thread
   */
  getMessages(threadId: string, options?: { limit?: number; offset?: number }): Promise<ContactMessage[]>;

  /**
   * Mark messages as read
   * @param threadId Thread ID
   * @param forStaff If true, mark user messages as read (for staff viewing)
   *                 If false, mark staff messages as read (for user viewing)
   */
  markMessagesAsRead(threadId: string, forStaff: boolean): Promise<number>;

  /**
   * Count unread messages for a user (across all their threads)
   */
  countUnreadForUser(userId: string): Promise<number>;

  /**
   * Count unread messages for staff (across all threads)
   */
  countUnreadForStaff(): Promise<number>;

  /**
   * Delete a thread and all its messages
   */
  deleteThread(id: string): Promise<boolean>;
}

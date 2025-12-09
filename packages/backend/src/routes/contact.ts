/**
 * Contact/Inquiry API Routes
 *
 * Provides endpoints for users to submit inquiries and for staff to manage them.
 * Supports bidirectional chat-style communication between users and staff.
 *
 * @module routes/contact
 */

import { Hono } from "hono";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { rateLimit, RateLimitPresets } from "../middleware/rateLimit.js";
import { generateId } from "shared";
import type { ContactSenderType } from "../db/schema/pg.js";

const app = new Hono();

/**
 * Valid contact categories
 */
const VALID_CATEGORIES = [
  "general",
  "bug_report",
  "feature_request",
  "account",
  "abuse",
  "other",
] as const;

type ContactCategory = (typeof VALID_CATEGORIES)[number];

// =============================================================================
// User-facing endpoints
// =============================================================================

/**
 * Create Contact Thread
 *
 * POST /api/contact/threads
 *
 * Creates a new contact thread with an initial message.
 * Can be used by logged-in users or anonymous visitors (with email).
 *
 * Request Body:
 * ```json
 * {
 *   "subject": "Question about...",
 *   "category": "general",
 *   "message": "Hello, I have a question...",
 *   "email": "user@example.com" // Required for anonymous users
 * }
 * ```
 */
app.post("/threads", optionalAuth(), rateLimit(RateLimitPresets.api), async (c) => {
  const user = c.get("user");
  const contactRepository = c.get("contactRepository");

  const body = await c.req.json();

  // Validate required fields
  if (!body.subject || typeof body.subject !== "string" || body.subject.trim().length === 0) {
    return c.json({ error: "Subject is required" }, 400);
  }

  if (!body.message || typeof body.message !== "string" || body.message.trim().length === 0) {
    return c.json({ error: "Message is required" }, 400);
  }

  // Validate category
  const category: ContactCategory = VALID_CATEGORIES.includes(body.category)
    ? body.category
    : "general";

  // Validate email for anonymous users
  if (!user && (!body.email || typeof body.email !== "string")) {
    return c.json({ error: "Email is required for anonymous submissions" }, 400);
  }

  // Simple email validation
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return c.json({ error: "Invalid email format" }, 400);
  }

  // Length validations
  if (body.subject.length > 200) {
    return c.json({ error: "Subject must be 200 characters or less" }, 400);
  }

  if (body.message.length > 10000) {
    return c.json({ error: "Message must be 10,000 characters or less" }, 400);
  }

  // Create thread
  const threadId = generateId();
  const thread = await contactRepository.createThread({
    id: threadId,
    userId: user?.id,
    subject: body.subject.trim(),
    category,
    email: body.email || user?.email,
  });

  // Create initial message
  const messageId = generateId();
  await contactRepository.createMessage({
    id: messageId,
    threadId: thread.id,
    senderId: user?.id,
    senderType: "user",
    content: body.message.trim(),
  });

  return c.json(
    {
      id: thread.id,
      subject: thread.subject,
      category: thread.category,
      status: thread.status,
      createdAt: thread.createdAt,
      message: "Your inquiry has been submitted. We will respond as soon as possible.",
    },
    201,
  );
});

/**
 * List User's Contact Threads
 *
 * GET /api/contact/threads
 *
 * Returns the logged-in user's contact threads.
 * For staff, use /api/contact/admin/threads instead.
 */
app.get("/threads", requireAuth(), async (c) => {
  const user = c.get("user");
  const contactRepository = c.get("contactRepository");

  const limit = Math.min(Number(c.req.query("limit")) || 20, 100);
  const offset = Number(c.req.query("offset")) || 0;

  const threads = await contactRepository.listThreads({
    userId: user!.id,
    limit,
    offset,
    sortBy: "updatedAt",
    sortOrder: "desc",
  });

  const total = await contactRepository.countThreads({ userId: user!.id });

  return c.json({
    threads: threads.map((thread) => ({
      id: thread.id,
      subject: thread.subject,
      category: thread.category,
      status: thread.status,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      lastMessagePreview: thread.lastMessagePreview,
      lastMessageAt: thread.lastMessageAt,
      messageCount: thread.messageCount,
      unreadCount: thread.unreadCount,
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + threads.length < total,
    },
  });
});

/**
 * Get Thread Details with Messages
 *
 * GET /api/contact/threads/:threadId
 *
 * Returns a thread with its messages.
 * Users can only access their own threads.
 */
app.get("/threads/:threadId", requireAuth(), async (c) => {
  const user = c.get("user");
  const contactRepository = c.get("contactRepository");
  const roleService = c.get("roleService");
  const threadId = c.req.param("threadId");

  const thread = await contactRepository.findThreadById(threadId);
  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  // Check access: user can access their own threads, staff can access any
  const canManageContacts = await roleService.canManageContacts(user!.id);
  if (thread.userId !== user!.id && !canManageContacts) {
    return c.json({ error: "Access denied" }, 403);
  }

  // Get messages
  const messages = await contactRepository.getMessages(threadId);

  // Mark staff messages as read for user
  if (thread.userId === user!.id) {
    await contactRepository.markMessagesAsRead(threadId, false);
  }

  return c.json({
    thread: {
      id: thread.id,
      subject: thread.subject,
      category: thread.category,
      status: thread.status,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    },
    messages: messages.map((msg) => ({
      id: msg.id,
      // Hide specific sender identity, show role type only
      senderType: msg.senderType,
      senderLabel:
        msg.senderType === "user"
          ? thread.userId === user!.id
            ? "You"
            : "User"
          : msg.senderType === "admin"
            ? "Administrator"
            : "Moderator",
      content: msg.content,
      createdAt: msg.createdAt,
      isRead: msg.isRead,
    })),
  });
});

/**
 * Add Message to Thread
 *
 * POST /api/contact/threads/:threadId/messages
 *
 * Adds a new message to an existing thread.
 * Users can only add to their own threads.
 */
app.post(
  "/threads/:threadId/messages",
  requireAuth(),
  rateLimit(RateLimitPresets.api),
  async (c) => {
    const user = c.get("user");
    const contactRepository = c.get("contactRepository");
    const threadId = c.req.param("threadId");

    const thread = await contactRepository.findThreadById(threadId);
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404);
    }

    // Users can only add to their own threads
    if (thread.userId !== user!.id) {
      return c.json({ error: "Access denied" }, 403);
    }

    // Cannot add to closed threads
    if (thread.status === "closed") {
      return c.json({ error: "This thread is closed" }, 400);
    }

    const body = await c.req.json();

    if (!body.message || typeof body.message !== "string" || body.message.trim().length === 0) {
      return c.json({ error: "Message is required" }, 400);
    }

    if (body.message.length > 10000) {
      return c.json({ error: "Message must be 10,000 characters or less" }, 400);
    }

    const messageId = generateId();
    const message = await contactRepository.createMessage({
      id: messageId,
      threadId,
      senderId: user!.id,
      senderType: "user",
      content: body.message.trim(),
    });

    // Reopen thread if it was resolved
    if (thread.status === "resolved") {
      await contactRepository.updateThreadStatus(threadId, "open");
    }

    return c.json(
      {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt,
      },
      201,
    );
  },
);

/**
 * Get Unread Count for User
 *
 * GET /api/contact/unread
 *
 * Returns the count of unread staff messages across all user's threads.
 */
app.get("/unread", requireAuth(), async (c) => {
  const user = c.get("user");
  const contactRepository = c.get("contactRepository");

  const unreadCount = await contactRepository.countUnreadForUser(user!.id);

  return c.json({ unreadCount });
});

// =============================================================================
// Staff/Admin endpoints
// =============================================================================

/**
 * Middleware to require contact management permission
 */
const requireContactManagement = () => async (c: any, next: any) => {
  const user = c.get("user");
  const roleService = c.get("roleService");

  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const canManage = await roleService.canManageContacts(user.id);
  if (!canManage) {
    return c.json({ error: "Permission denied" }, 403);
  }

  await next();
};

/**
 * List All Contact Threads (Staff)
 *
 * GET /api/contact/admin/threads
 *
 * Returns all contact threads with filtering options.
 * Requires canManageContacts permission.
 */
app.get("/admin/threads", requireAuth(), requireContactManagement(), async (c) => {
  const contactRepository = c.get("contactRepository");

  const limit = Math.min(Number(c.req.query("limit")) || 20, 100);
  const offset = Number(c.req.query("offset")) || 0;
  const status = c.req.query("status") as "open" | "in_progress" | "resolved" | "closed" | undefined;
  const category = c.req.query("category") as ContactCategory | undefined;
  const sortBy = (c.req.query("sortBy") as "createdAt" | "updatedAt" | "priority") || "updatedAt";
  const sortOrder = (c.req.query("sortOrder") as "asc" | "desc") || "desc";

  const filterOptions: {
    status?: "open" | "in_progress" | "resolved" | "closed";
    category?: string;
    limit: number;
    offset: number;
    sortBy: "createdAt" | "updatedAt" | "priority";
    sortOrder: "asc" | "desc";
  } = {
    limit,
    offset,
    sortBy,
    sortOrder,
  };

  if (status && ["open", "in_progress", "resolved", "closed"].includes(status)) {
    filterOptions.status = status;
  }
  if (category && VALID_CATEGORIES.includes(category)) {
    filterOptions.category = category;
  }

  const threads = await contactRepository.listThreads(filterOptions);
  const total = await contactRepository.countThreads({
    status: filterOptions.status,
    category: filterOptions.category,
  });

  return c.json({
    threads: threads.map((thread) => ({
      id: thread.id,
      userId: thread.userId,
      subject: thread.subject,
      category: thread.category,
      status: thread.status,
      priority: thread.priority,
      assignedToId: thread.assignedToId,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      lastMessagePreview: thread.lastMessagePreview,
      lastMessageAt: thread.lastMessageAt,
      messageCount: thread.messageCount,
      unreadCount: thread.unreadCount,
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + threads.length < total,
    },
  });
});

/**
 * Get Thread Details (Staff)
 *
 * GET /api/contact/admin/threads/:threadId
 *
 * Returns full thread details including internal notes.
 * Requires canManageContacts permission.
 */
app.get("/admin/threads/:threadId", requireAuth(), requireContactManagement(), async (c) => {
  const contactRepository = c.get("contactRepository");
  const userRepository = c.get("userRepository");
  const threadId = c.req.param("threadId");

  const thread = await contactRepository.findThreadById(threadId);
  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  // Get thread user info if available
  let threadUser = null;
  if (thread.userId) {
    const user = await userRepository.findById(thread.userId);
    if (user) {
      threadUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      };
    }
  }

  // Get messages
  const messages = await contactRepository.getMessages(threadId);

  // Mark user messages as read for staff
  await contactRepository.markMessagesAsRead(threadId, true);

  return c.json({
    thread: {
      id: thread.id,
      userId: thread.userId,
      user: threadUser,
      email: thread.email,
      subject: thread.subject,
      category: thread.category,
      status: thread.status,
      priority: thread.priority,
      assignedToId: thread.assignedToId,
      internalNotes: thread.internalNotes,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      closedAt: thread.closedAt,
    },
    messages: messages.map((msg) => ({
      id: msg.id,
      senderId: msg.senderId,
      senderType: msg.senderType,
      content: msg.content,
      createdAt: msg.createdAt,
      isRead: msg.isRead,
    })),
  });
});

/**
 * Reply to Thread (Staff)
 *
 * POST /api/contact/admin/threads/:threadId/messages
 *
 * Adds a staff reply to a thread.
 * Requires canManageContacts permission.
 */
app.post(
  "/admin/threads/:threadId/messages",
  requireAuth(),
  requireContactManagement(),
  rateLimit(RateLimitPresets.api),
  async (c) => {
    const user = c.get("user");
    const contactRepository = c.get("contactRepository");
    const roleService = c.get("roleService");
    const threadId = c.req.param("threadId");

    const thread = await contactRepository.findThreadById(threadId);
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404);
    }

    if (thread.status === "closed") {
      return c.json({ error: "Cannot reply to closed threads" }, 400);
    }

    const body = await c.req.json();

    if (!body.message || typeof body.message !== "string" || body.message.trim().length === 0) {
      return c.json({ error: "Message is required" }, 400);
    }

    if (body.message.length > 10000) {
      return c.json({ error: "Message must be 10,000 characters or less" }, 400);
    }

    // Determine sender type based on role
    const isAdmin = await roleService.isAdmin(user!.id);
    const senderType: ContactSenderType = isAdmin ? "admin" : "moderator";

    const messageId = generateId();
    const message = await contactRepository.createMessage({
      id: messageId,
      threadId,
      senderId: user!.id,
      senderType,
      content: body.message.trim(),
    });

    // Update thread status to in_progress if it was open
    if (thread.status === "open") {
      await contactRepository.updateThreadStatus(threadId, "in_progress");
    }

    return c.json(
      {
        id: message.id,
        senderType: message.senderType,
        content: message.content,
        createdAt: message.createdAt,
      },
      201,
    );
  },
);

/**
 * Update Thread Status (Staff)
 *
 * PATCH /api/contact/admin/threads/:threadId/status
 *
 * Updates the status of a thread.
 * Requires canManageContacts permission.
 */
app.patch(
  "/admin/threads/:threadId/status",
  requireAuth(),
  requireContactManagement(),
  async (c) => {
    const contactRepository = c.get("contactRepository");
    const threadId = c.req.param("threadId");

    const thread = await contactRepository.findThreadById(threadId);
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404);
    }

    const body = await c.req.json();
    const validStatuses = ["open", "in_progress", "resolved", "closed"] as const;

    if (!body.status || !validStatuses.includes(body.status)) {
      return c.json({ error: `Status must be one of: ${validStatuses.join(", ")}` }, 400);
    }

    const updatedThread = await contactRepository.updateThreadStatus(threadId, body.status);

    return c.json({
      id: updatedThread!.id,
      status: updatedThread!.status,
      closedAt: updatedThread!.closedAt,
    });
  },
);

/**
 * Update Thread Priority (Staff)
 *
 * PATCH /api/contact/admin/threads/:threadId/priority
 *
 * Updates the priority of a thread (0-3, higher = more urgent).
 * Requires canManageContacts permission.
 */
app.patch(
  "/admin/threads/:threadId/priority",
  requireAuth(),
  requireContactManagement(),
  async (c) => {
    const contactRepository = c.get("contactRepository");
    const threadId = c.req.param("threadId");

    const thread = await contactRepository.findThreadById(threadId);
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404);
    }

    const body = await c.req.json();

    if (typeof body.priority !== "number" || body.priority < 0 || body.priority > 3) {
      return c.json({ error: "Priority must be a number between 0 and 3" }, 400);
    }

    const updatedThread = await contactRepository.updateThreadPriority(threadId, body.priority);

    return c.json({
      id: updatedThread!.id,
      priority: updatedThread!.priority,
    });
  },
);

/**
 * Update Internal Notes (Staff)
 *
 * PATCH /api/contact/admin/threads/:threadId/notes
 *
 * Updates the internal notes for a thread (visible only to staff).
 * Requires canManageContacts permission.
 */
app.patch(
  "/admin/threads/:threadId/notes",
  requireAuth(),
  requireContactManagement(),
  async (c) => {
    const contactRepository = c.get("contactRepository");
    const threadId = c.req.param("threadId");

    const thread = await contactRepository.findThreadById(threadId);
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404);
    }

    const body = await c.req.json();

    if (typeof body.notes !== "string") {
      return c.json({ error: "Notes must be a string" }, 400);
    }

    if (body.notes.length > 5000) {
      return c.json({ error: "Notes must be 5,000 characters or less" }, 400);
    }

    const updatedThread = await contactRepository.updateInternalNotes(threadId, body.notes);

    return c.json({
      id: updatedThread!.id,
      internalNotes: updatedThread!.internalNotes,
    });
  },
);

/**
 * Get Unread Count for Staff
 *
 * GET /api/contact/admin/unread
 *
 * Returns the total count of unread user messages across all threads.
 * Requires canManageContacts permission.
 */
app.get("/admin/unread", requireAuth(), requireContactManagement(), async (c) => {
  const contactRepository = c.get("contactRepository");

  const unreadCount = await contactRepository.countUnreadForStaff();

  return c.json({ unreadCount });
});

/**
 * Get Contact Categories
 *
 * GET /api/contact/categories
 *
 * Returns the list of valid contact categories.
 */
app.get("/categories", (c) => {
  return c.json({
    categories: VALID_CATEGORIES.map((category) => ({
      value: category,
      label: category
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
    })),
  });
});

export default app;

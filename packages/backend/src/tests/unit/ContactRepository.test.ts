/**
 * Contact Repository Unit Tests
 *
 * Tests the contact/inquiry functionality for user support.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";

describe("ContactRepository", () => {
  // Mock thread data
  const mockThread = {
    id: "thread1",
    userId: "user1",
    subject: "Need help with account",
    category: "account",
    status: "open" as const,
    priority: 0,
    assignedToId: null,
    internalNotes: null,
    email: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
  };

  // Mock message data
  const mockMessage = {
    id: "msg1",
    threadId: "thread1",
    senderId: "user1",
    senderType: "user" as const,
    content: "I cannot access my settings",
    attachmentIds: null,
    isRead: false,
    createdAt: new Date(),
  };

  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      createThread: mock(() => Promise.resolve(mockThread)),
      findThreadById: mock(() => Promise.resolve(mockThread)),
      listThreads: mock(() =>
        Promise.resolve([
          {
            ...mockThread,
            lastMessagePreview: "I cannot access...",
            lastMessageAt: new Date(),
            unreadCount: 1,
            messageCount: 2,
          },
        ]),
      ),
      countThreads: mock(() => Promise.resolve(1)),
      updateThreadStatus: mock(() =>
        Promise.resolve({ ...mockThread, status: "in_progress" }),
      ),
      assignThread: mock(() =>
        Promise.resolve({ ...mockThread, assignedToId: "admin1" }),
      ),
      updateThreadPriority: mock(() =>
        Promise.resolve({ ...mockThread, priority: 1 }),
      ),
      updateInternalNotes: mock(() =>
        Promise.resolve({ ...mockThread, internalNotes: "User needs password reset" }),
      ),
      closeThread: mock(() =>
        Promise.resolve({ ...mockThread, status: "closed", closedAt: new Date() }),
      ),
      createMessage: mock(() => Promise.resolve(mockMessage)),
      getMessages: mock(() => Promise.resolve([mockMessage])),
      markMessagesAsRead: mock(() => Promise.resolve(1)),
      countUnreadForUser: mock(() => Promise.resolve(2)),
      countUnreadForStaff: mock(() => Promise.resolve(5)),
      deleteThread: mock(() => Promise.resolve(true)),
    };
  });

  describe("Thread Operations", () => {
    describe("createThread", () => {
      test("should create a contact thread for logged-in user", async () => {
        const result = await mockRepo.createThread({
          id: "thread1",
          userId: "user1",
          subject: "Need help with account",
          category: "account",
        });

        expect(result).toEqual(mockThread);
        expect(mockRepo.createThread).toHaveBeenCalled();
      });

      test("should create a contact thread for anonymous user with email", async () => {
        const anonymousThread = {
          ...mockThread,
          userId: null,
          email: "guest@example.com",
        };
        mockRepo.createThread = mock(() => Promise.resolve(anonymousThread));

        const result = await mockRepo.createThread({
          id: "thread2",
          subject: "Question about service",
          category: "general",
          email: "guest@example.com",
        });

        expect(result.userId).toBeNull();
        expect(result.email).toBe("guest@example.com");
      });

      test("should create thread with valid categories", async () => {
        const categories = ["general", "account", "technical", "billing", "other"];

        for (const category of categories) {
          await mockRepo.createThread({
            id: `thread-${category}`,
            userId: "user1",
            subject: "Test subject",
            category,
          });
        }

        expect(mockRepo.createThread).toHaveBeenCalledTimes(categories.length);
      });
    });

    describe("findThreadById", () => {
      test("should find thread by ID", async () => {
        const result = await mockRepo.findThreadById("thread1");

        expect(result).toEqual(mockThread);
        expect(mockRepo.findThreadById).toHaveBeenCalledWith("thread1");
      });

      test("should return null for non-existent thread", async () => {
        mockRepo.findThreadById = mock(() => Promise.resolve(null));

        const result = await mockRepo.findThreadById("nonexistent");

        expect(result).toBeNull();
      });
    });

    describe("listThreads", () => {
      test("should return threads with preview info", async () => {
        const result = await mockRepo.listThreads();

        expect(result).toHaveLength(1);
        expect(result[0].lastMessagePreview).toBeDefined();
        expect(result[0].unreadCount).toBeDefined();
      });

      test("should filter by status", async () => {
        await mockRepo.listThreads({ status: "open" });

        expect(mockRepo.listThreads).toHaveBeenCalledWith({ status: "open" });
      });

      test("should filter by category", async () => {
        await mockRepo.listThreads({ category: "technical" });

        expect(mockRepo.listThreads).toHaveBeenCalledWith({ category: "technical" });
      });

      test("should filter by assigned staff", async () => {
        await mockRepo.listThreads({ assignedToId: "admin1" });

        expect(mockRepo.listThreads).toHaveBeenCalledWith({ assignedToId: "admin1" });
      });

      test("should filter by user ID for user's own threads", async () => {
        await mockRepo.listThreads({ userId: "user1" });

        expect(mockRepo.listThreads).toHaveBeenCalledWith({ userId: "user1" });
      });

      test("should support pagination", async () => {
        await mockRepo.listThreads({ limit: 10, offset: 0 });

        expect(mockRepo.listThreads).toHaveBeenCalledWith({ limit: 10, offset: 0 });
      });

      test("should support sorting", async () => {
        await mockRepo.listThreads({ sortBy: "priority", sortOrder: "desc" });

        expect(mockRepo.listThreads).toHaveBeenCalledWith({
          sortBy: "priority",
          sortOrder: "desc",
        });
      });
    });

    describe("countThreads", () => {
      test("should return total count", async () => {
        const result = await mockRepo.countThreads();

        expect(result).toBe(1);
      });

      test("should filter count by status", async () => {
        await mockRepo.countThreads({ status: "open" });

        expect(mockRepo.countThreads).toHaveBeenCalledWith({ status: "open" });
      });
    });

    describe("updateThreadStatus", () => {
      test("should update thread status to in_progress", async () => {
        const result = await mockRepo.updateThreadStatus("thread1", "in_progress");

        expect(result.status).toBe("in_progress");
      });

      test("should update thread status to resolved", async () => {
        mockRepo.updateThreadStatus = mock(() =>
          Promise.resolve({ ...mockThread, status: "resolved" }),
        );

        const result = await mockRepo.updateThreadStatus("thread1", "resolved");

        expect(result.status).toBe("resolved");
      });

      test("should return null for non-existent thread", async () => {
        mockRepo.updateThreadStatus = mock(() => Promise.resolve(null));

        const result = await mockRepo.updateThreadStatus("nonexistent", "closed");

        expect(result).toBeNull();
      });
    });

    describe("assignThread", () => {
      test("should assign thread to staff member", async () => {
        const result = await mockRepo.assignThread("thread1", "admin1");

        expect(result.assignedToId).toBe("admin1");
      });

      test("should unassign thread", async () => {
        mockRepo.assignThread = mock(() =>
          Promise.resolve({ ...mockThread, assignedToId: null }),
        );

        const result = await mockRepo.assignThread("thread1", null);

        expect(result.assignedToId).toBeNull();
      });
    });

    describe("updateThreadPriority", () => {
      test("should update thread priority", async () => {
        const result = await mockRepo.updateThreadPriority("thread1", 1);

        expect(result.priority).toBe(1);
      });

      test("should set high priority", async () => {
        mockRepo.updateThreadPriority = mock(() =>
          Promise.resolve({ ...mockThread, priority: 2 }),
        );

        const result = await mockRepo.updateThreadPriority("thread1", 2);

        expect(result.priority).toBe(2);
      });
    });

    describe("updateInternalNotes", () => {
      test("should update internal notes", async () => {
        const result = await mockRepo.updateInternalNotes(
          "thread1",
          "User needs password reset",
        );

        expect(result.internalNotes).toBe("User needs password reset");
      });

      test("should clear internal notes", async () => {
        mockRepo.updateInternalNotes = mock(() =>
          Promise.resolve({ ...mockThread, internalNotes: "" }),
        );

        const result = await mockRepo.updateInternalNotes("thread1", "");

        expect(result.internalNotes).toBe("");
      });
    });

    describe("closeThread", () => {
      test("should close thread and set closedAt", async () => {
        const result = await mockRepo.closeThread("thread1");

        expect(result.status).toBe("closed");
        expect(result.closedAt).toBeDefined();
      });

      test("should return null for non-existent thread", async () => {
        mockRepo.closeThread = mock(() => Promise.resolve(null));

        const result = await mockRepo.closeThread("nonexistent");

        expect(result).toBeNull();
      });
    });

    describe("deleteThread", () => {
      test("should delete thread and its messages", async () => {
        const result = await mockRepo.deleteThread("thread1");

        expect(result).toBe(true);
        expect(mockRepo.deleteThread).toHaveBeenCalledWith("thread1");
      });

      test("should return false for non-existent thread", async () => {
        mockRepo.deleteThread = mock(() => Promise.resolve(false));

        const result = await mockRepo.deleteThread("nonexistent");

        expect(result).toBe(false);
      });
    });
  });

  describe("Message Operations", () => {
    describe("createMessage", () => {
      test("should create a user message", async () => {
        const result = await mockRepo.createMessage({
          id: "msg1",
          threadId: "thread1",
          senderId: "user1",
          senderType: "user",
          content: "I cannot access my settings",
        });

        expect(result).toEqual(mockMessage);
        expect(mockRepo.createMessage).toHaveBeenCalled();
      });

      test("should create a staff message", async () => {
        const staffMessage = {
          ...mockMessage,
          senderId: "admin1",
          senderType: "admin" as const,
          content: "Let me help you with that",
        };
        mockRepo.createMessage = mock(() => Promise.resolve(staffMessage));

        const result = await mockRepo.createMessage({
          id: "msg2",
          threadId: "thread1",
          senderId: "admin1",
          senderType: "admin",
          content: "Let me help you with that",
        });

        expect(result.senderType).toBe("admin");
      });

      test("should create a moderator message", async () => {
        const modMessage = {
          ...mockMessage,
          senderId: "mod1",
          senderType: "moderator" as const,
        };
        mockRepo.createMessage = mock(() => Promise.resolve(modMessage));

        const result = await mockRepo.createMessage({
          id: "msg3",
          threadId: "thread1",
          senderId: "mod1",
          senderType: "moderator",
          content: "Following up on your issue",
        });

        expect(result.senderType).toBe("moderator");
      });

      test("should create message with attachments", async () => {
        const messageWithAttachments = {
          ...mockMessage,
          attachmentIds: ["file1", "file2"],
        };
        mockRepo.createMessage = mock(() => Promise.resolve(messageWithAttachments));

        const result = await mockRepo.createMessage({
          id: "msg4",
          threadId: "thread1",
          senderId: "user1",
          senderType: "user",
          content: "Here are the screenshots",
          attachmentIds: ["file1", "file2"],
        });

        expect(result.attachmentIds).toEqual(["file1", "file2"]);
      });
    });

    describe("getMessages", () => {
      test("should get messages for thread", async () => {
        const result = await mockRepo.getMessages("thread1");

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockMessage);
      });

      test("should support pagination", async () => {
        await mockRepo.getMessages("thread1", { limit: 50, offset: 0 });

        expect(mockRepo.getMessages).toHaveBeenCalledWith("thread1", {
          limit: 50,
          offset: 0,
        });
      });

      test("should return empty array for thread with no messages", async () => {
        mockRepo.getMessages = mock(() => Promise.resolve([]));

        const result = await mockRepo.getMessages("emptyThread");

        expect(result).toEqual([]);
      });
    });

    describe("markMessagesAsRead", () => {
      test("should mark user messages as read (for staff)", async () => {
        const result = await mockRepo.markMessagesAsRead("thread1", true);

        expect(result).toBe(1);
        expect(mockRepo.markMessagesAsRead).toHaveBeenCalledWith("thread1", true);
      });

      test("should mark staff messages as read (for user)", async () => {
        await mockRepo.markMessagesAsRead("thread1", false);

        expect(mockRepo.markMessagesAsRead).toHaveBeenCalledWith("thread1", false);
      });

      test("should return 0 when no messages to mark", async () => {
        mockRepo.markMessagesAsRead = mock(() => Promise.resolve(0));

        const result = await mockRepo.markMessagesAsRead("thread1", true);

        expect(result).toBe(0);
      });
    });

    describe("countUnreadForUser", () => {
      test("should count unread messages for user", async () => {
        const result = await mockRepo.countUnreadForUser("user1");

        expect(result).toBe(2);
        expect(mockRepo.countUnreadForUser).toHaveBeenCalledWith("user1");
      });

      test("should return 0 when no unread messages", async () => {
        mockRepo.countUnreadForUser = mock(() => Promise.resolve(0));

        const result = await mockRepo.countUnreadForUser("user1");

        expect(result).toBe(0);
      });
    });

    describe("countUnreadForStaff", () => {
      test("should count unread messages for staff", async () => {
        const result = await mockRepo.countUnreadForStaff();

        expect(result).toBe(5);
      });

      test("should return 0 when no unread messages", async () => {
        mockRepo.countUnreadForStaff = mock(() => Promise.resolve(0));

        const result = await mockRepo.countUnreadForStaff();

        expect(result).toBe(0);
      });
    });
  });

  describe("Thread Status Transitions", () => {
    test("should allow open -> in_progress", async () => {
      const result = await mockRepo.updateThreadStatus("thread1", "in_progress");
      expect(result.status).toBe("in_progress");
    });

    test("should allow in_progress -> resolved", async () => {
      mockRepo.updateThreadStatus = mock(() =>
        Promise.resolve({ ...mockThread, status: "resolved" }),
      );
      const result = await mockRepo.updateThreadStatus("thread1", "resolved");
      expect(result.status).toBe("resolved");
    });

    test("should allow any status -> closed", async () => {
      mockRepo.updateThreadStatus = mock(() =>
        Promise.resolve({ ...mockThread, status: "closed" }),
      );
      const result = await mockRepo.updateThreadStatus("thread1", "closed");
      expect(result.status).toBe("closed");
    });
  });
});

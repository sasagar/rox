"use client";

/**
 * Admin Contacts Page
 *
 * Allows administrators and moderators with canManageContacts permission
 * to view and respond to user inquiries.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  RefreshCw,
  MessageCircle,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  User,
  Shield,
  Send,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { InlineError } from "../../components/ui/ErrorMessage";
import { addToastAtom } from "../../lib/atoms/toast";
import { Layout } from "../../components/layout/Layout";
import { AdminNav } from "../../components/admin/AdminNav";
import {
  listContactThreadsAdmin,
  getContactThreadAdmin,
  replyToContactThread,
  updateContactThreadStatus,
  updateContactThreadPriority,
  updateContactThreadNotes,
  getContactUnreadCountAdmin,
} from "../../lib/api/contact";
import type { ContactThreadSummary, ContactThreadAdmin, ContactMessageAdmin } from "shared";

const STATUS_CONFIG: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  open: {
    icon: <Clock className="w-4 h-4" />,
    label: "Open",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  in_progress: {
    icon: <AlertCircle className="w-4 h-4" />,
    label: "In Progress",
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  resolved: {
    icon: <CheckCircle className="w-4 h-4" />,
    label: "Resolved",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  closed: {
    icon: <XCircle className="w-4 h-4" />,
    label: "Closed",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  },
};

const PRIORITY_LABELS = ["Normal", "Low", "Medium", "High"];

interface AdminThreadSummary extends ContactThreadSummary {
  userId?: string;
  priority?: number;
  assignedToId?: string;
}

export default function AdminContactsPage() {
  const { t } = useLingui();
  const [currentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  // List state
  const [threads, setThreads] = useState<AdminThreadSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Detail view state
  const [selectedThread, setSelectedThread] = useState<ContactThreadAdmin | null>(null);
  const [messages, setMessages] = useState<ContactMessageAdmin[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Reply form
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const params: any = { limit, offset };
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }

      const response = await listContactThreadsAdmin(params);
      setThreads(response.threads as AdminThreadSummary[]);
      setTotal(response.pagination.total);

      // Also load unread count
      const unreadRes = await getContactUnreadCountAdmin();
      setUnreadCount(unreadRes.unreadCount);
    } catch (err: any) {
      setError(err.message || "Failed to load contact threads");
    } finally {
      setIsLoading(false);
    }
  }, [token, statusFilter, offset, limit]);

  const loadThreadDetail = useCallback(
    async (threadId: string) => {
      if (!token) return;

      setIsLoadingDetail(true);
      try {
        const response = await getContactThreadAdmin(threadId);
        setSelectedThread(response.thread);
        setMessages(response.messages);
        setInternalNotes(response.thread.internalNotes || "");
      } catch (err: any) {
        addToast({
          type: "error",
          message: err.message || "Failed to load thread",
        });
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [token, addToast],
  );

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || isSending || !selectedThread) return;

    setIsSending(true);
    try {
      const newMessage = await replyToContactThread(selectedThread.id, replyText.trim());
      setMessages((prev) => [
        ...prev,
        {
          id: newMessage.id,
          senderId: currentUser?.id,
          senderType: newMessage.senderType as any,
          content: newMessage.content,
          createdAt: newMessage.createdAt,
          isRead: true,
        },
      ]);
      setReplyText("");
      addToast({ type: "success", message: "Reply sent" });

      // Reload thread list to update status
      loadThreads();
    } catch (err: any) {
      addToast({ type: "error", message: err.message || "Failed to send reply" });
    } finally {
      setIsSending(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (!selectedThread) return;

    try {
      await updateContactThreadStatus(selectedThread.id, status);
      setSelectedThread((prev) => (prev ? { ...prev, status: status as any } : null));
      addToast({ type: "success", message: "Status updated" });
      loadThreads();
    } catch (err: any) {
      addToast({ type: "error", message: err.message || "Failed to update status" });
    }
  }

  async function handlePriorityChange(priority: number) {
    if (!selectedThread) return;

    try {
      await updateContactThreadPriority(selectedThread.id, priority);
      setSelectedThread((prev) => (prev ? { ...prev, priority } : null));
      addToast({ type: "success", message: "Priority updated" });
      loadThreads();
    } catch (err: any) {
      addToast({ type: "error", message: err.message || "Failed to update priority" });
    }
  }

  async function handleSaveNotes() {
    if (!selectedThread) return;

    try {
      await updateContactThreadNotes(selectedThread.id, internalNotes);
      addToast({ type: "success", message: "Notes saved" });
    } catch (err: any) {
      addToast({ type: "error", message: err.message || "Failed to save notes" });
    }
  }

  if (!currentUser) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  // Detail view
  if (selectedThread) {
    const isClosed = selectedThread.status === "closed";

    return (
      <Layout>
        <div className="max-w-6xl mx-auto">
          <AdminNav currentPath="/admin/contacts" />

          <div className="mb-4">
            <button
              onClick={() => setSelectedThread(null)}
              className="inline-flex items-center text-sm text-(--text-muted) hover:text-(--text-primary) mb-3"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <Trans>Back to list</Trans>
            </button>

            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-(--text-primary)">
                  {selectedThread.subject}
                </h1>
                <div className="flex items-center gap-3 mt-2 text-sm text-(--text-muted)">
                  {selectedThread.user && (
                    <span>
                      <Trans>From:</Trans> @{selectedThread.user.username}
                    </span>
                  )}
                  {selectedThread.email && (
                    <span>
                      <Trans>Email:</Trans> {selectedThread.email}
                    </span>
                  )}
                  <span>{new Date(selectedThread.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedThread.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="px-3 py-1.5 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) text-sm"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>

                <select
                  value={selectedThread.priority}
                  onChange={(e) => handlePriorityChange(Number(e.target.value))}
                  className="px-3 py-1.5 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) text-sm"
                >
                  {PRIORITY_LABELS.map((label, idx) => (
                    <option key={idx} value={idx}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Messages */}
            <div className="lg:col-span-2">
              <Card className="mb-4">
                <CardContent className="p-0">
                  <div className="divide-y divide-(--border-color) max-h-[50vh] overflow-y-auto">
                    {isLoadingDetail ? (
                      <div className="flex justify-center py-8">
                        <Spinner size="md" />
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isUser = msg.senderType === "user";
                        return (
                          <div
                            key={msg.id}
                            className={`p-4 ${isUser ? "bg-(--bg-primary)" : "bg-(--bg-secondary)"}`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  isUser
                                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                }`}
                              >
                                {isUser ? <User className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-(--text-primary)">
                                    {isUser
                                      ? selectedThread.user?.username || "User"
                                      : msg.senderType === "admin"
                                        ? "Administrator"
                                        : "Moderator"}
                                  </span>
                                  <span className="text-xs text-(--text-muted)">
                                    {new Date(msg.createdAt).toLocaleString()}
                                  </span>
                                  {!msg.isRead && (
                                    <span className="px-1.5 py-0.5 text-xs bg-primary-500 text-white rounded">
                                      New
                                    </span>
                                  )}
                                </div>
                                <p className="text-(--text-secondary) whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </CardContent>
              </Card>

              {/* Reply form */}
              {!isClosed ? (
                <Card>
                  <CardContent className="p-4">
                    <form onSubmit={handleSendReply}>
                      <div className="flex gap-3">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={t`Type your reply...`}
                          maxLength={10000}
                          rows={3}
                          className="flex-1 px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                          disabled={isSending}
                        />
                        <Button
                          type="submit"
                          isDisabled={!replyText.trim() || isSending}
                          className="self-end"
                        >
                          {isSending ? (
                            <Spinner size="sm" />
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              <Trans>Send</Trans>
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-(--text-muted)">
                      <Trans>This thread is closed.</Trans>
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <Trans>Internal Notes</Trans>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-(--text-muted) mb-2">
                    <Trans>Only visible to staff</Trans>
                  </p>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    maxLength={5000}
                    rows={6}
                    className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) text-sm resize-none"
                    placeholder={t`Add notes about this inquiry...`}
                  />
                  <Button
                    variant="secondary"
                    onPress={handleSaveNotes}
                    className="mt-2 w-full"
                  >
                    <Trans>Save Notes</Trans>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // List view
  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <AdminNav currentPath="/admin/contacts" />

        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-(--text-primary) flex items-center gap-3">
              <MessageCircle className="w-7 h-7" />
              <Trans>Contact Inquiries</Trans>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-sm bg-primary-500 text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-(--text-muted) mt-1">
              <Trans>Manage user inquiries and support requests</Trans>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setOffset(0);
              }}
              className="px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary)"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <Button variant="secondary" onPress={loadThreads}>
              <RefreshCw className="w-4 h-4 mr-2" />
              <Trans>Refresh</Trans>
            </Button>
          </div>
        </div>

        {error && (
          <InlineError message={error} className="mb-4" />
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : threads.length === 0 ? (
              <div className="text-center py-12 text-(--text-muted)">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>
                  <Trans>No inquiries found</Trans>
                </p>
              </div>
            ) : (
              <div className="divide-y divide-(--border-color)">
                {threads.map((thread) => {
                  const statusConf = STATUS_CONFIG[thread.status] ?? STATUS_CONFIG.open;
                  return (
                    <button
                      key={thread.id}
                      onClick={() => loadThreadDetail(thread.id)}
                      className="w-full text-left p-4 hover:bg-(--bg-secondary) transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConf?.color ?? ""}`}
                            >
                              {statusConf?.icon}
                              {statusConf?.label}
                            </span>
                            {thread.unreadCount > 0 && (
                              <span className="px-2 py-0.5 text-xs bg-primary-500 text-white rounded-full">
                                {thread.unreadCount} new
                              </span>
                            )}
                            {(thread as any).priority > 0 && (
                              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                {PRIORITY_LABELS[(thread as any).priority]}
                              </span>
                            )}
                          </div>
                          <h3 className="font-medium text-(--text-primary) truncate">
                            {thread.subject}
                          </h3>
                          {thread.lastMessagePreview && (
                            <p className="text-sm text-(--text-muted) truncate mt-1">
                              {thread.lastMessagePreview}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-(--text-muted) mt-2">
                            <span>{new Date(thread.updatedAt).toLocaleDateString()}</span>
                            <span>{thread.messageCount} messages</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-(--text-muted) flex-shrink-0 ml-2" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {total > limit && (
          <div className="flex justify-center gap-2 mt-4">
            <Button
              variant="secondary"
              onPress={() => setOffset(Math.max(0, offset - limit))}
              isDisabled={offset === 0}
            >
              <Trans>Previous</Trans>
            </Button>
            <span className="px-4 py-2 text-sm text-(--text-muted)">
              {offset + 1} - {Math.min(offset + limit, total)} / {total}
            </span>
            <Button
              variant="secondary"
              onPress={() => setOffset(offset + limit)}
              isDisabled={offset + limit >= total}
            >
              <Trans>Next</Trans>
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

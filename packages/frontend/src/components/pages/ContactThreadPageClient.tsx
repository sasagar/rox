"use client";

/**
 * Contact Thread Detail Page Client Component
 *
 * Displays a contact thread in a chat-style interface.
 * Users can view messages and send replies.
 */

import { useEffect, useState, useRef } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Layout } from "../layout/Layout";
import { Card, CardContent } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import { Button } from "../ui/Button";
import { SpaLink } from "../ui/SpaLink";
import { useAtomValue } from "jotai";
import { currentUserAtom } from "../../lib/atoms/auth";
import { getContactThread, addContactMessage } from "../../lib/api/contact";
import type { ContactThread, ContactMessage } from "shared";
import {
  ArrowLeft,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Shield,
} from "lucide-react";

const statusConfig: Record<
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

interface ContactThreadPageClientProps {
  threadId: string;
}

export function ContactThreadPageClient({ threadId }: ContactThreadPageClientProps) {
  const { t } = useLingui();
  const currentUser = useAtomValue(currentUserAtom);
  const [mounted, setMounted] = useState(false);
  const [thread, setThread] = useState<ContactThread | null>(null);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reply form
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && currentUser && threadId) {
      loadThread();
    }
  }, [mounted, currentUser, threadId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadThread() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await getContactThread(threadId);
      setThread(res.thread);
      setMessages(res.messages);
    } catch (err: any) {
      setError(err.message || "Failed to load thread");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || isSending) return;

    setIsSending(true);
    try {
      const newMessage = await addContactMessage(threadId, replyText.trim());
      setMessages((prev) => [
        ...prev,
        {
          id: newMessage.id,
          senderType: "user",
          senderLabel: "You",
          content: newMessage.content,
          createdAt: newMessage.createdAt,
          isRead: true,
        },
      ]);
      setReplyText("");
    } catch (err: any) {
      alert(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  if (!mounted) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (!currentUser) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto text-center py-10">
          <p className="text-(--text-muted)">
            <Trans>Please log in to view your inquiries.</Trans>
          </p>
          <SpaLink to="/login" className="text-primary-600 dark:text-primary-400 hover:underline">
            <Trans>Log in</Trans>
          </SpaLink>
        </div>
      </Layout>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error || !thread) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-red-600 dark:text-red-400 mb-4">{error || "Thread not found"}</p>
              <SpaLink to="/contact">
                <Button variant="secondary">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  <Trans>Back to Contact</Trans>
                </Button>
              </SpaLink>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const status = statusConfig[thread.status] || statusConfig.open;
  const isClosed = thread.status === "closed";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <SpaLink
            to="/contact"
            className="inline-flex items-center text-sm text-(--text-muted) hover:text-(--text-primary) mb-3"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            <Trans>Back to Contact</Trans>
          </SpaLink>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-(--text-primary)">{thread.subject}</h1>
              <p className="text-sm text-(--text-muted) mt-1">
                <Trans>Created {new Date(thread.createdAt).toLocaleDateString()}</Trans>
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${status?.color ?? ""}`}
            >
              {status?.icon}
              {status?.label}
            </span>
          </div>
        </div>

        {/* Messages */}
        <Card className="mb-4">
          <CardContent className="p-0">
            <div className="divide-y divide-(--border-color) max-h-[60vh] overflow-y-auto">
              {messages.map((msg) => {
                const isUser = msg.senderType === "user";
                return (
                  <div
                    key={msg.id}
                    className={`p-4 ${isUser ? "bg-(--bg-primary)" : "bg-(--bg-secondary)"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isUser
                            ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {isUser ? <User className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-(--text-primary)">
                            {msg.senderLabel}
                          </span>
                          <span className="text-xs text-(--text-muted)">
                            {new Date(msg.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-(--text-secondary) whitespace-pre-wrap wrap-break-word">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                    placeholder={t`Type your message...`}
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
                <Trans>This inquiry has been closed. Please create a new inquiry if you need further assistance.</Trans>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

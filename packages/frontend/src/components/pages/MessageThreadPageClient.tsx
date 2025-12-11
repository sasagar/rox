"use client";

/**
 * Message thread page client component
 *
 * Displays a DM conversation with a specific user
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useAtom, useAtomValue } from "jotai";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { Layout } from "../layout/Layout";
import { PageHeader } from "../ui/PageHeader";
import { Avatar } from "../ui/Avatar";
import { Spinner } from "../ui/Spinner";
import { InlineError } from "../ui/ErrorMessage";
import { MfmRenderer } from "../mfm/MfmRenderer";
import { UserDisplayName } from "../user/UserDisplayName";
import { useDirectMessageThread } from "../../hooks/useDirectMessages";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { addToastAtom } from "../../lib/atoms/toast";
import { apiClient } from "../../lib/api/client";
import { notesApi } from "../../lib/api/notes";
import { usersApi, type User } from "../../lib/api/users";
import type { Note } from "../../lib/types/note";
import { NOTE_TEXT_MAX_LENGTH } from "shared";

/**
 * Format timestamp for messages
 */
function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Message bubble component
 */
function MessageBubble({
  message,
  isOwn,
  showAvatar,
}: {
  message: Note;
  isOwn: boolean;
  showAvatar: boolean;
}) {
  return (
    <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {showAvatar ? (
        <Avatar
          src={message.user?.avatarUrl}
          alt={message.user?.name || message.user?.username || "User"}
          fallback={(message.user?.username || "U").charAt(0).toUpperCase()}
          size="sm"
          className="shrink-0"
        />
      ) : (
        <div className="w-8" /> // Spacer for alignment
      )}
      <div className={`flex flex-col max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-2 ${
            isOwn
              ? "bg-primary-500 text-white rounded-br-md"
              : "bg-gray-200 dark:bg-gray-700 text-(--text-primary) rounded-bl-md"
          }`}
        >
          {message.cw ? (
            <details className="cursor-pointer">
              <summary className="text-sm font-medium">{message.cw}</summary>
              <div className="mt-2">
                <MfmRenderer text={message.text || ""} />
              </div>
            </details>
          ) : (
            <MfmRenderer text={message.text || ""} />
          )}
        </div>
        <span className={`text-xs text-(--text-muted) mt-1 ${isOwn ? "text-right" : "text-left"}`}>
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

/**
 * Simple message composer for DM thread
 */
function MessageComposer({
  partnerId,
  currentUser,
  onMessageSent,
}: {
  partnerId: string;
  currentUser: { id: string; username: string; name?: string | null; avatarUrl?: string | null };
  onMessageSent: (message: Note) => void;
}) {
  const token = useAtomValue(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (token) {
        apiClient.setToken(token);
      }
      const newNote = await notesApi.createNote({
        text: text.trim(),
        visibility: "specified",
        visibleUserIds: [partnerId],
      });
      setText("");
      // Add current user info for optimistic UI update
      const noteWithUser: Note = {
        ...newNote,
        user: {
          id: currentUser.id,
          username: currentUser.username,
          name: currentUser.name || currentUser.username,
          avatarUrl: currentUser.avatarUrl || undefined,
          host: undefined,
        },
      };
      onMessageSent(noteWithUser);
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t`Failed to send message`;
      addToast({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const charCount = text.length;
  const isOverLimit = charCount > NOTE_TEXT_MAX_LENGTH;

  return (
    <form onSubmit={handleSubmit} className="border-t border-(--border-color) p-4 bg-(--card-bg)">
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={t`Write a message...`}
            disabled={isSubmitting}
            rows={1}
            className="w-full px-4 py-2 bg-(--bg-secondary) border border-(--border-color) rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 text-(--text-primary) placeholder:text-(--text-muted)"
            style={{ minHeight: "42px", maxHeight: "150px" }}
          />
          {charCount > 0 && (
            <span
              className={`absolute right-3 bottom-2 text-xs ${
                isOverLimit ? "text-red-500" : "text-(--text-muted)"
              }`}
            >
              {charCount}/{NOTE_TEXT_MAX_LENGTH}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!text.trim() || isSubmitting || isOverLimit}
          className="p-2.5 bg-primary-500 text-white rounded-full hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </form>
  );
}

export function MessageThreadPageClient({ partnerId }: { partnerId: string }) {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const token = useAtomValue(tokenAtom);
  const [isLoading, setIsLoading] = useState(true);
  const [partner, setPartner] = useState<User | null>(null);
  const [partnerError, setPartnerError] = useState<string | null>(null);

  const { messages, loading, hasMore, fetchThread, loadMore, addMessage, fetchNewMessages } =
    useDirectMessageThread(partnerId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Restore user session on mount
  useEffect(() => {
    const restoreSession = async () => {
      if (!token) {
        window.location.href = "/login";
        return;
      }

      if (!currentUser) {
        try {
          apiClient.setToken(token);
          const response = await apiClient.get<{ user: any }>("/api/auth/session");
          setCurrentUser(response.user);
          setIsLoading(false);
        } catch (error) {
          console.error("Failed to restore session:", error);
          window.location.href = "/login";
          return;
        }
      } else {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, [token, currentUser, setCurrentUser]);

  // Fetch partner info
  useEffect(() => {
    const fetchPartner = async () => {
      try {
        const user = await usersApi.getById(partnerId);
        setPartner(user);
      } catch {
        setPartnerError(t`User not found`);
      }
    };

    if (!isLoading && currentUser) {
      fetchPartner();
    }
  }, [isLoading, currentUser, partnerId]);

  // Fetch thread on load
  useEffect(() => {
    if (!isLoading && currentUser && partner) {
      fetchThread();
    }
  }, [isLoading, currentUser, partner, fetchThread]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!isLoading && currentUser && partner && messages.length > 0) {
      const intervalId = setInterval(() => {
        fetchNewMessages();
      }, 5000);

      return () => clearInterval(intervalId);
    }
    return undefined;
  }, [isLoading, currentUser, partner, messages.length, fetchNewMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  const handleMessageSent = useCallback(
    (message: Note) => {
      addMessage(message);
    },
    [addMessage],
  );

  // Infinite scroll for older messages
  const loadMoreRef = useInfiniteScroll({
    onLoadMore: loadMore,
    isLoading: loading,
    hasMore,
    threshold: 0.1,
    rootMargin: "100px",
  });

  // Show loading while checking auth
  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-primary)">
        <Spinner size="lg" />
      </div>
    );
  }

  if (partnerError) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-8 px-4">
          <InlineError message={partnerError} />
          <a href="/messages" className="mt-4 inline-block text-primary-600 hover:underline">
            <Trans>Back to messages</Trans>
          </a>
        </div>
      </Layout>
    );
  }

  const partnerDisplayName = partner?.displayName || partner?.name || partner?.username || "User";
  const partnerHandle = partner?.host
    ? `@${partner.username}@${partner.host}`
    : `@${partner?.username}`;

  // Build subtitle with partner info
  const subtitle = partner ? (
    <span className="flex items-center gap-2">
      <Avatar
        src={partner.avatarUrl}
        alt={partnerDisplayName}
        fallback={partnerDisplayName.charAt(0).toUpperCase()}
        size="sm"
      />
      <span className="truncate">
        <UserDisplayName
          name={partner.displayName || partner.name}
          username={partner.username}
          profileEmojis={partner.profileEmojis}
        />
        <span className="text-(--text-muted) ml-1">{partnerHandle}</span>
      </span>
    </span>
  ) : (
    <span className="h-4 w-32 bg-(--bg-secondary) rounded animate-pulse inline-block" />
  );

  const pageHeader = (
    <PageHeader
      title={<Trans>Conversation</Trans>}
      subtitle={subtitle}
      icon={<MessageCircle className="w-6 h-6" />}
      backHref="/messages"
    />
  );

  return (
    <Layout header={pageHeader} maxWidth="2xl">
      <div className="flex flex-col" style={{ minHeight: "calc(100vh - 280px)" }}>
        {/* Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto space-y-3 -mx-3 sm:-mx-4 px-3 sm:px-4"
        >
          {/* Load more trigger at top */}
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-2">
              {loading && <Loader2 className="w-5 h-5 animate-spin text-(--text-muted)" />}
            </div>
          )}

          {/* Messages in reverse chronological order (newest at bottom) */}
          {[...messages].reverse().map((message, index, arr) => {
            const prevMessage = arr[index - 1];
            const isOwn = message.user?.id === currentUser.id;
            const prevIsOwn = prevMessage?.user?.id === currentUser.id;
            const showAvatar = !prevMessage || isOwn !== prevIsOwn;

            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
              />
            );
          })}

          {/* Empty state */}
          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-(--text-muted)">
              <p className="text-center">
                <Trans>No messages yet. Start the conversation!</Trans>
              </p>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer - sticky at bottom */}
        <div className="sticky bottom-0 -mx-3 sm:-mx-4 mt-4">
          <MessageComposer partnerId={partnerId} currentUser={currentUser} onMessageSent={handleMessageSent} />
        </div>
      </div>
    </Layout>
  );
}

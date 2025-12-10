"use client";

/**
 * Messages page component
 *
 * Shows list of conversation partners for direct messages
 */

import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Mail, Loader2, PenSquare } from "lucide-react";
import { Layout } from "../../components/layout/Layout";
import { Avatar } from "../../components/ui/Avatar";
import { MfmRenderer } from "../../components/mfm/MfmRenderer";
import { useConversations } from "../../hooks/useDirectMessages";
import { currentUserAtom, tokenAtom } from "../../lib/atoms/auth";
import { openComposeModalAtom } from "../../lib/atoms/compose";
import { apiClient } from "../../lib/api/client";
import type { ConversationPartner } from "../../lib/api/direct";

/**
 * Format time relative to now
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString();
}

/**
 * Conversation partner item component
 */
function ConversationItem({ conversation }: { conversation: ConversationPartner }) {
  const displayName = conversation.partnerDisplayName || conversation.partnerUsername;
  const handle = conversation.partnerHost
    ? `@${conversation.partnerUsername}@${conversation.partnerHost}`
    : `@${conversation.partnerUsername}`;

  // Convert profileEmojis array to emoji map for MfmRenderer
  const customEmojis = conversation.partnerProfileEmojis?.reduce(
    (acc, emoji) => {
      acc[emoji.name] = emoji.url;
      return acc;
    },
    {} as Record<string, string>,
  ) ?? {};

  return (
    <a
      href={`/messages/${conversation.partnerId}`}
      className="flex items-center gap-3 p-4 hover:bg-(--bg-secondary) transition-colors cursor-pointer"
    >
      <Avatar
        src={conversation.partnerAvatarUrl}
        alt={displayName}
        fallback={displayName.charAt(0).toUpperCase()}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <span className="font-medium text-(--text-primary) truncate">
              <MfmRenderer text={displayName} customEmojis={customEmojis} />
            </span>
            <span className="text-sm text-(--text-muted) truncate">
              {handle}
            </span>
          </div>
          <span className="text-xs text-(--text-muted) whitespace-nowrap">
            {formatRelativeTime(conversation.lastNoteCreatedAt)}
          </span>
        </div>
        <p className="text-sm text-(--text-secondary) truncate mt-0.5">
          {conversation.lastNoteText || <Trans>(No message)</Trans>}
        </p>
      </div>
    </a>
  );
}

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const token = useAtomValue(tokenAtom);
  const [isLoading, setIsLoading] = useState(true);
  const openComposeModal = useSetAtom(openComposeModalAtom);

  const { conversations, loading, fetchConversations } = useConversations();

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

  // Fetch conversations on load
  useEffect(() => {
    if (!isLoading && currentUser) {
      fetchConversations();
    }
  }, [isLoading, currentUser, fetchConversations]);

  // Show loading while checking auth
  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-primary)">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-(--text-primary)" />
              <h1 className="text-xl sm:text-2xl font-bold text-(--text-primary)">
                <Trans>Messages</Trans>
              </h1>
            </div>
            <button
              type="button"
              onClick={() => openComposeModal({ initialVisibility: "specified" })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors cursor-pointer"
            >
              <PenSquare className="w-4 h-4" />
              <span className="hidden sm:inline"><Trans>New Message</Trans></span>
            </button>
          </div>
          <p className="mt-2 text-sm text-(--text-muted)">
            <Trans>Your direct message conversations</Trans>
          </p>
        </div>

        {/* Conversations List */}
        <div className="bg-(--card-bg) rounded-lg border border-(--border-color) overflow-hidden">
          {loading && conversations.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-(--text-muted)" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-(--text-muted)">
              <Mail className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">
                <Trans>No messages yet</Trans>
              </p>
              <p className="text-sm mt-1 text-center px-4">
                <Trans>Start a conversation by composing a direct message</Trans>
              </p>
            </div>
          ) : (
            <div className="divide-y divide-(--border-color)">
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.partnerId}
                  conversation={conversation}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

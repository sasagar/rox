"use client";

/**
 * Direct Messages hooks for fetching and managing DMs
 */

import { useState, useCallback } from "react";
import { useAtomValue } from "jotai";
import { isAuthenticatedAtom } from "../lib/atoms/auth";
import { directApi, type ConversationPartner } from "../lib/api/direct";
import type { Note, TimelineOptions } from "../lib/types/note";

/**
 * Hook to fetch and manage conversation partners list
 */
export function useConversations() {
  const [conversations, setConversations] = useState<ConversationPartner[]>([]);
  const [loading, setLoading] = useState(false);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  /**
   * Fetch conversations from API
   */
  const fetchConversations = useCallback(
    async (limit = 20) => {
      if (!isAuthenticated) return;

      setLoading(true);
      try {
        const data = await directApi.getConversations(limit);
        setConversations(data);
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated],
  );

  /**
   * Refresh conversations
   */
  const refresh = useCallback(async () => {
    await fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    loading,
    fetchConversations,
    refresh,
  };
}

/**
 * Hook to fetch and manage all direct messages
 */
export function useDirectMessages() {
  const [messages, setMessages] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  /**
   * Fetch all DMs from API
   */
  const fetchMessages = useCallback(
    async (options: TimelineOptions = {}) => {
      if (!isAuthenticated) return;

      setLoading(true);
      try {
        const data = await directApi.getMessages({ limit: 20, ...options });

        if (options.untilId) {
          // Pagination: append to existing
          setMessages((prev) => [...prev, ...data]);
        } else {
          // Initial load or refresh: replace
          setMessages(data);
        }

        // Check if there are more items
        setHasMore(data.length >= (options.limit || 20));
      } catch (error) {
        console.error("Failed to fetch direct messages:", error);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated],
  );

  /**
   * Load more messages (pagination)
   */
  const loadMore = useCallback(async () => {
    if (messages.length === 0 || loading || !hasMore) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      await fetchMessages({ untilId: lastMessage.id });
    }
  }, [messages, loading, hasMore, fetchMessages]);

  /**
   * Refresh messages
   */
  const refresh = useCallback(async () => {
    setHasMore(true);
    await fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    loading,
    hasMore,
    fetchMessages,
    loadMore,
    refresh,
  };
}

/**
 * Hook to fetch and manage a DM thread with a specific user
 */
export function useDirectMessageThread(partnerId: string | null) {
  const [messages, setMessages] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  /**
   * Fetch thread messages from API
   */
  const fetchThread = useCallback(
    async (options: TimelineOptions = {}) => {
      if (!isAuthenticated || !partnerId) return;

      setLoading(true);
      try {
        const data = await directApi.getThread(partnerId, { limit: 50, ...options });

        if (options.untilId) {
          // Pagination: append to existing
          setMessages((prev) => [...prev, ...data]);
        } else {
          // Initial load or refresh: replace
          setMessages(data);
        }

        // Check if there are more items
        setHasMore(data.length >= (options.limit || 50));
      } catch (error) {
        console.error("Failed to fetch DM thread:", error);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, partnerId],
  );

  /**
   * Load more messages (pagination)
   */
  const loadMore = useCallback(async () => {
    if (messages.length === 0 || loading || !hasMore) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      await fetchThread({ untilId: lastMessage.id });
    }
  }, [messages, loading, hasMore, fetchThread]);

  /**
   * Refresh thread
   */
  const refresh = useCallback(async () => {
    setHasMore(true);
    await fetchThread();
  }, [fetchThread]);

  /**
   * Add a new message to the thread (optimistic update)
   */
  const addMessage = useCallback((message: Note) => {
    setMessages((prev) => [message, ...prev]);
  }, []);

  /**
   * Fetch new messages since the latest one (for polling)
   */
  const fetchNewMessages = useCallback(async () => {
    if (!isAuthenticated || !partnerId || messages.length === 0) return;

    const latestMessage = messages[0]; // messages are sorted newest first
    if (!latestMessage) return;

    try {
      const newMessages = await directApi.getThread(partnerId, {
        sinceId: latestMessage.id,
        limit: 50,
      });

      if (newMessages.length > 0) {
        // Prepend new messages (they come sorted newest first)
        setMessages((prev) => {
          // Filter out any duplicates (in case optimistic update already added it)
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueNewMessages = newMessages.filter((m) => !existingIds.has(m.id));
          return [...uniqueNewMessages, ...prev];
        });
      }
    } catch (error) {
      console.error("Failed to fetch new DM messages:", error);
    }
  }, [isAuthenticated, partnerId, messages]);

  return {
    messages,
    loading,
    hasMore,
    fetchThread,
    loadMore,
    refresh,
    addMessage,
    fetchNewMessages,
  };
}

"use client";

/**
 * Mention Suggestions Hook
 *
 * Provides autocomplete suggestions for @mentions in text input.
 * Detects when the user is typing a mention and fetches matching users.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { usersApi } from "../lib/api/users";
import type { User } from "../lib/types/user";

export interface MentionSuggestion {
  user: User;
  label: string;
  value: string;
}

export interface UseMentionSuggestionsResult {
  /** Current suggestions to display */
  suggestions: MentionSuggestion[];
  /** Whether suggestions are currently loading */
  isLoading: boolean;
  /** Index of currently selected suggestion */
  selectedIndex: number;
  /** Whether suggestions popup should be visible */
  showSuggestions: boolean;
  /** Current mention query being typed */
  mentionQuery: string;
  /** Position of the @ symbol in the text */
  mentionStart: number;
  /** Handle text change to detect mentions */
  handleTextChange: (text: string, cursorPosition: number) => void;
  /** Handle keyboard navigation in suggestions */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  /** Select a suggestion */
  selectSuggestion: (suggestion: MentionSuggestion) => string;
  /** Close suggestions */
  closeSuggestions: () => void;
}

/**
 * Hook to provide mention autocomplete functionality
 *
 * @example
 * ```tsx
 * const { suggestions, handleTextChange, handleKeyDown, selectSuggestion, showSuggestions } = useMentionSuggestions();
 *
 * <textarea
 *   onChange={(e) => {
 *     setText(e.target.value);
 *     handleTextChange(e.target.value, e.target.selectionStart);
 *   }}
 *   onKeyDown={(e) => {
 *     if (handleKeyDown(e)) {
 *       e.preventDefault();
 *     }
 *   }}
 * />
 * {showSuggestions && <SuggestionsPopup suggestions={suggestions} />}
 * ```
 */
export function useMentionSuggestions(): UseMentionSuggestionsResult {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTextRef = useRef("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Detect mention pattern in text at cursor position
   */
  const detectMention = useCallback((text: string, cursorPosition: number): { query: string; start: number } | null => {
    // Look backwards from cursor to find @
    let start = cursorPosition - 1;
    while (start >= 0) {
      const char = text[start];
      // Stop if we hit whitespace or another @
      if (char === " " || char === "\n" || char === "\t") {
        return null;
      }
      if (char === "@") {
        // Found the @, extract the query
        const query = text.substring(start + 1, cursorPosition);
        // Only trigger if query is non-empty and doesn't contain spaces
        if (query.length > 0 && !query.includes(" ")) {
          return { query, start };
        }
        return null;
      }
      start--;
    }
    return null;
  }, []);

  /**
   * Fetch user suggestions from API
   */
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const users = await usersApi.search(query, { limit: 8 });
      const newSuggestions: MentionSuggestion[] = users.map((user) => ({
        user,
        label: user.displayName || user.username,
        value: user.host ? `@${user.username}@${user.host}` : `@${user.username}`,
      }));
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
      setSelectedIndex(0);
    } catch (error) {
      console.error("Failed to fetch mention suggestions:", error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Handle text change and detect mentions
   */
  const handleTextChange = useCallback(
    (text: string, cursorPosition: number) => {
      currentTextRef.current = text;

      // Clear any pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const mention = detectMention(text, cursorPosition);

      if (mention) {
        setMentionQuery(mention.query);
        setMentionStart(mention.start);

        // Debounce API call
        debounceTimerRef.current = setTimeout(() => {
          fetchSuggestions(mention.query);
        }, 150);
      } else {
        setMentionQuery("");
        setMentionStart(-1);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    },
    [detectMention, fetchSuggestions],
  );

  /**
   * Handle keyboard navigation
   * Returns true if the event was handled (should prevent default)
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!showSuggestions || suggestions.length === 0) {
        return false;
      }

      switch (e.key) {
        case "ArrowDown":
          setSelectedIndex((prev) => (prev + 1) % suggestions.length);
          return true;
        case "ArrowUp":
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          return true;
        case "Enter":
        case "Tab":
          // Selection will be handled by the component
          return true;
        case "Escape":
          setShowSuggestions(false);
          return true;
        default:
          return false;
      }
    },
    [showSuggestions, suggestions.length],
  );

  /**
   * Select a suggestion and return the new text
   */
  const selectSuggestion = useCallback(
    (suggestion: MentionSuggestion): string => {
      if (mentionStart < 0) {
        return currentTextRef.current;
      }

      const text = currentTextRef.current;
      // Replace the @query with the selected mention
      const beforeMention = text.substring(0, mentionStart);
      const afterMention = text.substring(mentionStart + 1 + mentionQuery.length);
      const newText = beforeMention + suggestion.value + " " + afterMention;

      // Close suggestions
      setShowSuggestions(false);
      setSuggestions([]);
      setMentionQuery("");
      setMentionStart(-1);

      return newText;
    },
    [mentionStart, mentionQuery],
  );

  /**
   * Close suggestions without selecting
   */
  const closeSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(0);
  }, []);

  return {
    suggestions,
    isLoading,
    selectedIndex,
    showSuggestions,
    mentionQuery,
    mentionStart,
    handleTextChange,
    handleKeyDown,
    selectSuggestion,
    closeSuggestions,
  };
}

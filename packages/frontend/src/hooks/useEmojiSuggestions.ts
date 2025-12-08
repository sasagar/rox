"use client";

/**
 * Emoji Suggestions Hook
 *
 * Provides autocomplete suggestions for :emoji: shortcodes in text input.
 * Detects when the user is typing an emoji shortcode and shows matching emojis.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { emojiListAtom, fetchEmojisAtom } from "../lib/atoms/customEmoji";

/**
 * Common Unicode emojis with their shortcodes
 * This is a subset of commonly used emojis for quick access
 */
const UNICODE_EMOJIS: { emoji: string; names: string[] }[] = [
  // Smileys
  { emoji: "😀", names: ["grinning", "smile"] },
  { emoji: "😃", names: ["smiley"] },
  { emoji: "😄", names: ["smile", "happy"] },
  { emoji: "😁", names: ["grin"] },
  { emoji: "😆", names: ["laughing", "satisfied"] },
  { emoji: "😅", names: ["sweat_smile"] },
  { emoji: "🤣", names: ["rofl", "rolling_on_the_floor_laughing"] },
  { emoji: "😂", names: ["joy", "tears_of_joy"] },
  { emoji: "🙂", names: ["slightly_smiling_face"] },
  { emoji: "😉", names: ["wink"] },
  { emoji: "😊", names: ["blush"] },
  { emoji: "😇", names: ["innocent", "angel"] },
  { emoji: "🥰", names: ["smiling_face_with_hearts"] },
  { emoji: "😍", names: ["heart_eyes"] },
  { emoji: "🤩", names: ["star_struck", "starstruck"] },
  { emoji: "😘", names: ["kissing_heart"] },
  { emoji: "😋", names: ["yum", "delicious"] },
  { emoji: "😛", names: ["stuck_out_tongue"] },
  { emoji: "😜", names: ["stuck_out_tongue_winking_eye", "wink_tongue"] },
  { emoji: "🤪", names: ["zany_face", "crazy"] },
  { emoji: "🤔", names: ["thinking", "think"] },
  { emoji: "🤗", names: ["hugs", "hugging"] },
  { emoji: "🤭", names: ["face_with_hand_over_mouth"] },
  { emoji: "🤫", names: ["shushing_face", "quiet"] },
  { emoji: "🤐", names: ["zipper_mouth_face"] },
  { emoji: "😏", names: ["smirk"] },
  { emoji: "😒", names: ["unamused"] },
  { emoji: "🙄", names: ["roll_eyes", "eye_roll"] },
  { emoji: "😬", names: ["grimacing"] },
  { emoji: "😌", names: ["relieved"] },
  { emoji: "😔", names: ["pensive"] },
  { emoji: "😪", names: ["sleepy"] },
  { emoji: "😴", names: ["sleeping", "zzz"] },
  { emoji: "😷", names: ["mask"] },
  { emoji: "🤒", names: ["face_with_thermometer", "sick"] },
  { emoji: "🤕", names: ["face_with_head_bandage", "injured"] },
  { emoji: "🤢", names: ["nauseated_face", "sick"] },
  { emoji: "🤮", names: ["vomiting_face", "puke"] },
  { emoji: "🥵", names: ["hot_face", "hot"] },
  { emoji: "🥶", names: ["cold_face", "cold", "freezing"] },
  { emoji: "😵", names: ["dizzy_face"] },
  { emoji: "🤯", names: ["exploding_head", "mind_blown"] },
  { emoji: "😎", names: ["sunglasses", "cool"] },
  { emoji: "🥳", names: ["partying_face", "party"] },
  { emoji: "😢", names: ["cry", "sad"] },
  { emoji: "😭", names: ["sob", "crying"] },
  { emoji: "😤", names: ["triumph", "angry"] },
  { emoji: "😡", names: ["rage", "angry"] },
  { emoji: "🤬", names: ["cursing_face", "swearing"] },
  { emoji: "😱", names: ["scream", "shocked"] },
  { emoji: "😰", names: ["cold_sweat"] },
  { emoji: "😨", names: ["fearful"] },
  { emoji: "😳", names: ["flushed"] },
  { emoji: "🥺", names: ["pleading_face", "puppy_eyes"] },
  { emoji: "😐", names: ["neutral_face"] },
  { emoji: "😑", names: ["expressionless"] },
  { emoji: "😶", names: ["no_mouth"] },
  // Hands
  { emoji: "👍", names: ["thumbsup", "thumbs_up", "+1", "like"] },
  { emoji: "👎", names: ["thumbsdown", "thumbs_down", "-1", "dislike"] },
  { emoji: "👋", names: ["wave", "hi", "hello"] },
  { emoji: "👏", names: ["clap", "applause"] },
  { emoji: "🙌", names: ["raised_hands", "hooray"] },
  { emoji: "🤝", names: ["handshake"] },
  { emoji: "🙏", names: ["pray", "please", "thanks"] },
  { emoji: "👌", names: ["ok_hand", "ok"] },
  { emoji: "✌️", names: ["v", "peace"] },
  { emoji: "🤞", names: ["crossed_fingers"] },
  { emoji: "🤟", names: ["love_you_gesture", "ily"] },
  { emoji: "🤘", names: ["metal", "rock"] },
  { emoji: "💪", names: ["muscle", "strong", "flex"] },
  { emoji: "✊", names: ["fist"] },
  { emoji: "👊", names: ["punch", "facepunch"] },
  // Hearts & Love
  { emoji: "❤️", names: ["heart", "love", "red_heart"] },
  { emoji: "🧡", names: ["orange_heart"] },
  { emoji: "💛", names: ["yellow_heart"] },
  { emoji: "💚", names: ["green_heart"] },
  { emoji: "💙", names: ["blue_heart"] },
  { emoji: "💜", names: ["purple_heart"] },
  { emoji: "🖤", names: ["black_heart"] },
  { emoji: "🤍", names: ["white_heart"] },
  { emoji: "💔", names: ["broken_heart"] },
  { emoji: "💕", names: ["two_hearts"] },
  { emoji: "💖", names: ["sparkling_heart"] },
  { emoji: "💗", names: ["heartpulse"] },
  { emoji: "💘", names: ["cupid"] },
  { emoji: "💝", names: ["gift_heart"] },
  // Symbols
  { emoji: "✨", names: ["sparkles", "stars"] },
  { emoji: "⭐", names: ["star"] },
  { emoji: "🌟", names: ["star2", "glowing_star"] },
  { emoji: "💫", names: ["dizzy", "shooting_star"] },
  { emoji: "🔥", names: ["fire", "hot", "lit"] },
  { emoji: "💯", names: ["100", "hundred"] },
  { emoji: "💢", names: ["anger"] },
  { emoji: "💥", names: ["boom", "collision"] },
  { emoji: "💦", names: ["sweat_drops"] },
  { emoji: "💨", names: ["dash"] },
  { emoji: "🎉", names: ["tada", "party", "celebration"] },
  { emoji: "🎊", names: ["confetti_ball"] },
  { emoji: "✅", names: ["check", "white_check_mark"] },
  { emoji: "❌", names: ["x", "cross"] },
  { emoji: "⚠️", names: ["warning"] },
  { emoji: "❓", names: ["question"] },
  { emoji: "❗", names: ["exclamation", "bang"] },
  { emoji: "💤", names: ["zzz", "sleep"] },
  // Food & Drink
  { emoji: "☕", names: ["coffee"] },
  { emoji: "🍵", names: ["tea"] },
  { emoji: "🍺", names: ["beer"] },
  { emoji: "🍻", names: ["beers", "cheers"] },
  { emoji: "🍷", names: ["wine_glass", "wine"] },
  { emoji: "🍕", names: ["pizza"] },
  { emoji: "🍔", names: ["hamburger", "burger"] },
  { emoji: "🍟", names: ["fries"] },
  { emoji: "🍰", names: ["cake"] },
  { emoji: "🎂", names: ["birthday", "birthday_cake"] },
  { emoji: "🍩", names: ["doughnut", "donut"] },
  { emoji: "🍪", names: ["cookie"] },
  // Animals
  { emoji: "🐱", names: ["cat"] },
  { emoji: "🐶", names: ["dog"] },
  { emoji: "🐻", names: ["bear"] },
  { emoji: "🐼", names: ["panda", "panda_face"] },
  { emoji: "🦊", names: ["fox", "fox_face"] },
  { emoji: "🐰", names: ["rabbit", "bunny"] },
  { emoji: "🐸", names: ["frog"] },
  { emoji: "🐵", names: ["monkey_face"] },
  { emoji: "🦁", names: ["lion", "lion_face"] },
  { emoji: "🐯", names: ["tiger"] },
  { emoji: "🐮", names: ["cow"] },
  { emoji: "🐷", names: ["pig"] },
  // Nature
  { emoji: "🌸", names: ["cherry_blossom"] },
  { emoji: "🌹", names: ["rose"] },
  { emoji: "🌻", names: ["sunflower"] },
  { emoji: "🌈", names: ["rainbow"] },
  { emoji: "☀️", names: ["sun", "sunny"] },
  { emoji: "🌙", names: ["moon", "crescent_moon"] },
  { emoji: "⛅", names: ["partly_sunny"] },
  { emoji: "🌧️", names: ["rain", "cloud_with_rain"] },
  { emoji: "❄️", names: ["snowflake", "snow"] },
  // Objects
  { emoji: "💻", names: ["computer", "laptop"] },
  { emoji: "📱", names: ["iphone", "phone", "mobile"] },
  { emoji: "📷", names: ["camera"] },
  { emoji: "🎮", names: ["video_game", "game"] },
  { emoji: "🎵", names: ["musical_note", "music"] },
  { emoji: "🎶", names: ["notes", "music"] },
  { emoji: "📚", names: ["books"] },
  { emoji: "✏️", names: ["pencil"] },
  { emoji: "💡", names: ["bulb", "idea", "lightbulb"] },
  { emoji: "🔔", names: ["bell"] },
  { emoji: "🔒", names: ["lock"] },
  { emoji: "🔑", names: ["key"] },
];

export interface EmojiSuggestion {
  /** Emoji character or shortcode */
  emoji: string;
  /** Name/shortcode of the emoji */
  name: string;
  /** Whether this is a custom emoji */
  isCustom: boolean;
  /** URL for custom emoji image */
  url?: string;
}

export interface UseEmojiSuggestionsResult {
  /** Current suggestions to display */
  suggestions: EmojiSuggestion[];
  /** Whether suggestions are currently loading */
  isLoading: boolean;
  /** Index of currently selected suggestion */
  selectedIndex: number;
  /** Whether suggestions popup should be visible */
  showSuggestions: boolean;
  /** Current emoji query being typed */
  emojiQuery: string;
  /** Position of the : symbol in the text */
  emojiStart: number;
  /** Handle text change to detect emoji shortcodes */
  handleTextChange: (text: string, cursorPosition: number) => void;
  /** Handle keyboard navigation in suggestions */
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  /** Select a suggestion */
  selectSuggestion: (suggestion: EmojiSuggestion) => string;
  /** Close suggestions */
  closeSuggestions: () => void;
}

/**
 * Hook to provide emoji autocomplete functionality
 *
 * @example
 * ```tsx
 * const { suggestions, handleTextChange, handleKeyDown, selectSuggestion, showSuggestions } = useEmojiSuggestions();
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
export function useEmojiSuggestions(): UseEmojiSuggestionsResult {
  const [suggestions, setSuggestions] = useState<EmojiSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [emojiStart, setEmojiStart] = useState(-1);

  const customEmojis = useAtomValue(emojiListAtom);
  const fetchEmojis = useSetAtom(fetchEmojisAtom);

  const currentTextRef = useRef("");

  // Fetch custom emojis on mount
  useEffect(() => {
    fetchEmojis(false).catch(() => {
      // Ignore errors, we'll work with Unicode emojis only
    });
  }, [fetchEmojis]);

  // Build searchable emoji list from Unicode emojis
  const unicodeEmojiMap = useMemo(() => {
    const map: Map<string, { emoji: string; name: string }> = new Map();
    for (const { emoji, names } of UNICODE_EMOJIS) {
      for (const name of names) {
        if (!map.has(name)) {
          map.set(name, { emoji, name });
        }
      }
    }
    return map;
  }, []);

  /**
   * Detect emoji shortcode pattern in text at cursor position
   */
  const detectEmoji = useCallback(
    (text: string, cursorPosition: number): { query: string; start: number } | null => {
      // Look backwards from cursor to find :
      let start = cursorPosition - 1;
      while (start >= 0) {
        const char = text[start];
        // Stop if we hit whitespace or newline
        if (char === " " || char === "\n" || char === "\t") {
          return null;
        }
        // Stop if we hit another : (closing of previous emoji)
        if (char === ":" && start < cursorPosition - 1) {
          return null;
        }
        if (char === ":") {
          // Found the :, extract the query
          const query = text.substring(start + 1, cursorPosition);
          // Only trigger if query has at least 2 characters and doesn't contain spaces
          if (query.length >= 2 && !query.includes(" ") && !query.includes(":")) {
            return { query, start };
          }
          return null;
        }
        start--;
      }
      return null;
    },
    [],
  );

  /**
   * Search for matching emojis
   */
  const searchEmojis = useCallback(
    (query: string): EmojiSuggestion[] => {
      const results: EmojiSuggestion[] = [];
      const queryLower = query.toLowerCase();
      const seen = new Set<string>();

      // Search custom emojis first (they take priority)
      for (const emoji of customEmojis) {
        const nameLower = emoji.name.toLowerCase();
        const matchesName = nameLower.includes(queryLower);
        const matchesAlias = emoji.aliases.some((a) => a.toLowerCase().includes(queryLower));

        if (matchesName || matchesAlias) {
          if (!seen.has(emoji.name)) {
            seen.add(emoji.name);
            results.push({
              emoji: `:${emoji.name}:`,
              name: emoji.name,
              isCustom: true,
              url: emoji.url,
            });
          }
        }

        // Limit results
        if (results.length >= 8) {
          return results;
        }
      }

      // Search Unicode emojis
      for (const [name, data] of unicodeEmojiMap) {
        if (name.includes(queryLower)) {
          if (!seen.has(name)) {
            seen.add(name);
            results.push({
              emoji: data.emoji,
              name: data.name,
              isCustom: false,
            });
          }
        }

        // Limit results
        if (results.length >= 8) {
          break;
        }
      }

      return results;
    },
    [customEmojis, unicodeEmojiMap],
  );

  /**
   * Handle text change and detect emoji shortcodes
   */
  const handleTextChange = useCallback(
    (text: string, cursorPosition: number) => {
      currentTextRef.current = text;

      const emoji = detectEmoji(text, cursorPosition);

      if (emoji) {
        setEmojiQuery(emoji.query);
        setEmojiStart(emoji.start);
        setIsLoading(true);

        // Search for emojis
        const found = searchEmojis(emoji.query);
        setSuggestions(found);
        setShowSuggestions(found.length > 0);
        setSelectedIndex(0);
        setIsLoading(false);
      } else {
        setEmojiQuery("");
        setEmojiStart(-1);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    },
    [detectEmoji, searchEmojis],
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
    (suggestion: EmojiSuggestion): string => {
      if (emojiStart < 0) {
        return currentTextRef.current;
      }

      const text = currentTextRef.current;
      // Replace the :query with the selected emoji
      const beforeEmoji = text.substring(0, emojiStart);
      const afterEmoji = text.substring(emojiStart + 1 + emojiQuery.length);

      // For custom emojis, use the :name: format
      // For Unicode emojis, insert the actual emoji character
      const insertText = suggestion.isCustom ? `:${suggestion.name}: ` : `${suggestion.emoji} `;
      const newText = beforeEmoji + insertText + afterEmoji;

      // Close suggestions
      setShowSuggestions(false);
      setSuggestions([]);
      setEmojiQuery("");
      setEmojiStart(-1);

      return newText;
    },
    [emojiStart, emojiQuery],
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
    emojiQuery,
    emojiStart,
    handleTextChange,
    handleKeyDown,
    selectSuggestion,
    closeSuggestions,
  };
}

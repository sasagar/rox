"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  Smile,
  X,
  Clock,
  Hand,
  Dog,
  Pizza,
  Plane,
  Lightbulb,
  Heart,
  Flag,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "./Button";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "react-aria-components";
import {
  emojiListAtom,
  emojiCategoriesAtom,
  emojisByCategoryAtom,
  emojiLoadingAtom,
  fetchEmojisAtom,
  type CustomEmoji,
} from "../../lib/atoms/customEmoji";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";

/**
 * Number of emojis to render per page for virtualization
 */
const EMOJIS_PER_PAGE = 100;

/**
 * Emoji categories with their emojis
 */
const EMOJI_CATEGORIES = {
  recent: {
    name: "Recently Used",
    icon: <Clock className="w-5 h-5" />,
    emojis: [] as string[], // Will be populated from localStorage
  },
  smileys: {
    name: "Smileys & Emotion",
    icon: <Smile className="w-5 h-5" />,
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "🙃",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😗",
      "😚",
      "😙",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤑",
      "🤗",
      "🤭",
      "🤫",
      "🤔",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "😏",
      "😒",
      "🙄",
      "😬",
      "🤥",
      "😌",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
      "🤢",
      "🤮",
      "🤧",
      "🥵",
      "🥶",
      "😵",
      "🤯",
      "🤠",
      "🥳",
      "😎",
      "🤓",
      "🧐",
    ],
  },
  people: {
    name: "People & Body",
    icon: <Hand className="w-5 h-5" />,
    emojis: [
      "👋",
      "🤚",
      "🖐️",
      "✋",
      "🖖",
      "👌",
      "🤏",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "🖕",
      "👇",
      "☝️",
      "👍",
      "👎",
      "✊",
      "👊",
      "🤛",
      "🤜",
      "👏",
      "🙌",
      "👐",
      "🤲",
      "🤝",
      "🙏",
      "💪",
      "🦵",
      "🦶",
      "👂",
      "🦻",
      "👃",
      "🧠",
      "🦷",
      "🦴",
      "👀",
      "👁️",
      "👅",
      "👄",
      "💋",
      "🩸",
    ],
  },
  animals: {
    name: "Animals & Nature",
    icon: <Dog className="w-5 h-5" />,
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🐔",
      "🐧",
      "🐦",
      "🐤",
      "🦆",
      "🦅",
      "🦉",
      "🦇",
      "🐺",
      "🐗",
      "🐴",
      "🦄",
      "🐝",
      "🐛",
      "🦋",
      "🐌",
      "🐞",
      "🐜",
      "🦟",
      "🦗",
      "🕷️",
      "🦂",
      "🐢",
      "🐍",
      "🦎",
      "🦖",
      "🦕",
      "🐙",
      "🦑",
      "🦐",
      "🦞",
      "🦀",
      "🐡",
      "🐠",
      "🐟",
      "🐬",
      "🐳",
      "🐋",
      "🦈",
      "🐊",
      "🐅",
      "🐆",
      "🦓",
      "🦍",
      "🦧",
    ],
  },
  food: {
    name: "Food & Drink",
    icon: <Pizza className="w-5 h-5" />,
    emojis: [
      "🍎",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "🍆",
      "🥑",
      "🥦",
      "🥬",
      "🥒",
      "🌶️",
      "🌽",
      "🥕",
      "🧄",
      "🧅",
      "🥔",
      "🍠",
      "🥐",
      "🥯",
      "🍞",
      "🥖",
      "🥨",
      "🧀",
      "🥚",
      "🍳",
      "🧈",
      "🥞",
      "🧇",
      "🥓",
      "🥩",
      "🍗",
      "🍖",
      "🌭",
      "🍔",
      "🍟",
      "🍕",
      "🥪",
      "🥙",
      "🧆",
      "🌮",
      "🌯",
      "🥗",
      "🥘",
      "🍝",
      "🍜",
      "🍲",
      "🍛",
      "🍣",
      "🍱",
    ],
  },
  activities: {
    name: "Activities",
    icon: <Lightbulb className="w-5 h-5" />,
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🥎",
      "🎾",
      "🏐",
      "🏉",
      "🥏",
      "🎱",
      "🪀",
      "🏓",
      "🏸",
      "🏒",
      "🏑",
      "🥍",
      "🏏",
      "🥅",
      "⛳",
      "🪁",
      "🏹",
      "🎣",
      "🤿",
      "🥊",
      "🥋",
      "🎽",
      "🛹",
      "🛷",
      "⛸️",
      "🥌",
      "🎿",
      "⛷️",
      "🏂",
      "🪂",
      "🏋️",
      "🤼",
      "🤸",
      "🤾",
      "🏌️",
      "🏇",
      "🧘",
      "🏊",
      "🤽",
      "🚣",
      "🧗",
      "🚴",
      "🚵",
      "🤹",
      "🎪",
      "🎨",
    ],
  },
  travel: {
    name: "Travel & Places",
    icon: <Plane className="w-5 h-5" />,
    emojis: [
      "🚗",
      "🚕",
      "🚙",
      "🚌",
      "🚎",
      "🏎️",
      "🚓",
      "🚑",
      "🚒",
      "🚐",
      "🚚",
      "🚛",
      "🚜",
      "🛴",
      "🚲",
      "🛵",
      "🏍️",
      "🛺",
      "🚨",
      "🚔",
      "🚍",
      "🚘",
      "🚖",
      "🚡",
      "🚠",
      "🚟",
      "🚃",
      "🚋",
      "🚞",
      "🚝",
      "🚄",
      "🚅",
      "🚈",
      "🚂",
      "🚆",
      "🚇",
      "🚊",
      "🚉",
      "✈️",
      "🛫",
      "🛬",
      "🛩️",
      "💺",
      "🛰️",
      "🚀",
      "🛸",
      "🚁",
      "🛶",
      "⛵",
      "🚤",
      "🛳️",
      "⛴️",
      "🛥️",
      "🚢",
      "⚓",
      "⛽",
      "🚧",
      "🚦",
      "🚥",
      "🗺️",
    ],
  },
  objects: {
    name: "Objects",
    icon: <Lightbulb className="w-5 h-5" />,
    emojis: [
      "⌚",
      "📱",
      "📲",
      "💻",
      "⌨️",
      "🖥️",
      "🖨️",
      "🖱️",
      "🖲️",
      "🕹️",
      "🗜️",
      "💽",
      "💾",
      "💿",
      "📀",
      "📼",
      "📷",
      "📸",
      "📹",
      "🎥",
      "📽️",
      "🎞️",
      "📞",
      "☎️",
      "📟",
      "📠",
      "📺",
      "📻",
      "🎙️",
      "🎚️",
      "🎛️",
      "🧭",
      "⏱️",
      "⏲️",
      "⏰",
      "🕰️",
      "⌛",
      "⏳",
      "📡",
      "🔋",
      "🔌",
      "💡",
      "🔦",
      "🕯️",
      "🪔",
      "🧯",
      "🛢️",
      "💸",
      "💵",
      "💴",
      "💶",
      "💷",
      "💰",
      "💳",
      "🪙",
      "💎",
      "⚖️",
      "🪜",
      "🧰",
      "🪛",
    ],
  },
  symbols: {
    name: "Symbols",
    icon: <Heart className="w-5 h-5" />,
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💟",
      "☮️",
      "✝️",
      "☪️",
      "🕉️",
      "☸️",
      "✡️",
      "🔯",
      "🕎",
      "☯️",
      "☦️",
      "🛐",
      "⛎",
      "♈",
      "♉",
      "♊",
      "♋",
      "♌",
      "♍",
      "♎",
      "♏",
      "♐",
      "♑",
      "♒",
      "♓",
      "🆔",
      "⚛️",
      "🉑",
      "☢️",
      "☣️",
      "📴",
      "📳",
      "🈶",
      "🈚",
      "🈸",
      "🈺",
      "🈷️",
      "✴️",
      "🆚",
      "💮",
      "🉐",
      "㊙️",
    ],
  },
  flags: {
    name: "Flags",
    icon: <Flag className="w-5 h-5" />,
    emojis: [
      "🏁",
      "🚩",
      "🎌",
      "🏴",
      "🏳️",
      "🏳️‍🌈",
      "🏳️‍⚧️",
      "🏴‍☠️",
      "🇦🇨",
      "🇦🇩",
      "🇦🇪",
      "🇦🇫",
      "🇦🇬",
      "🇦🇮",
      "🇦🇱",
      "🇦🇲",
      "🇦🇴",
      "🇦🇶",
      "🇦🇷",
      "🇦🇸",
      "🇦🇹",
      "🇦🇺",
      "🇦🇼",
      "🇦🇽",
      "🇦🇿",
      "🇧🇦",
      "🇧🇧",
      "🇧🇩",
      "🇧🇪",
      "🇧🇫",
      "🇧🇬",
      "🇧🇭",
      "🇧🇮",
      "🇧🇯",
      "🇧🇱",
      "🇧🇲",
      "🇧🇳",
      "🇧🇴",
      "🇧🇶",
      "🇧🇷",
      "🇧🇸",
      "🇧🇹",
      "🇧🇻",
      "🇧🇼",
      "🇧🇾",
      "🇧🇿",
      "🇨🇦",
      "🇨🇨",
      "🇨🇩",
      "🇨🇫",
      "🇨🇬",
      "🇨🇭",
      "🇨🇮",
      "🇨🇰",
      "🇨🇱",
      "🇨🇲",
      "🇨🇳",
      "🇨🇴",
      "🇨🇵",
      "🇨🇷",
      "🇨🇺",
      "🇨🇻",
      "🇨🇼",
      "🇨🇽",
      "🇨🇾",
      "🇨🇿",
      "🇩🇪",
      "🇩🇬",
      "🇩🇯",
      "🇩🇰",
      "🇩🇲",
      "🇩🇴",
      "🇩🇿",
      "🇪🇦",
      "🇪🇨",
      "🇪🇪",
      "🇪🇬",
      "🇪🇭",
      "🇪🇷",
      "🇪🇸",
      "🇪🇹",
      "🇪🇺",
      "🇫🇮",
      "🇫🇯",
      "🇫🇰",
      "🇫🇲",
      "🇫🇴",
      "🇫🇷",
      "🇬🇦",
      "🇬🇧",
      "🇬🇩",
      "🇬🇪",
      "🇬🇫",
      "🇬🇬",
      "🇬🇭",
      "🇬🇮",
      "🇬🇱",
      "🇬🇲",
      "🇬🇳",
      "🇬🇵",
      "🇬🇶",
      "🇬🇷",
      "🇬🇸",
      "🇬🇹",
      "🇬🇺",
      "🇬🇼",
      "🇬🇾",
      "🇭🇰",
      "🇭🇲",
      "🇭🇳",
      "🇭🇷",
      "🇭🇹",
      "🇭🇺",
      "🇮🇨",
      "🇮🇩",
      "🇮🇪",
      "🇮🇱",
      "🇮🇲",
      "🇮🇳",
      "🇮🇴",
      "🇮🇶",
      "🇮🇷",
      "🇮🇸",
      "🇮🇹",
      "🇯🇪",
      "🇯🇲",
      "🇯🇴",
      "🇯🇵",
    ],
  },
} as const;

type EmojiCategory = keyof typeof EMOJI_CATEGORIES;

const RECENT_EMOJIS_KEY = "rox-recent-emojis";
const MAX_RECENT_EMOJIS = 30;

/**
 * Props for the EmojiPicker component
 */
export interface EmojiPickerProps {
  /**
   * Callback when an emoji is selected
   */
  onEmojiSelect: (emoji: string) => void;
  /**
   * Trigger button for the picker
   */
  trigger?: React.ReactNode;
  /**
   * Whether the picker is disabled
   */
  isDisabled?: boolean;
}

/**
 * Emoji picker component with categories and search
 *
 * Features:
 * - Multiple emoji categories
 * - Recently used emojis
 * - Search functionality
 * - Keyboard navigation
 * - Custom emoji support (future)
 *
 * @example
 * ```tsx
 * <EmojiPicker
 *   onEmojiSelect={(emoji) => console.log('Selected:', emoji)}
 * />
 * ```
 */
export function EmojiPicker({ onEmojiSelect, trigger, isDisabled }: EmojiPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<EmojiCategory | string>("smileys");
  const [selectedCustomCategory, setSelectedCustomCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(EMOJIS_PER_PAGE);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const emojiGridRef = useRef<HTMLDivElement>(null);

  // Custom emoji state
  const customEmojis = useAtomValue(emojiListAtom);
  const customCategories = useAtomValue(emojiCategoriesAtom);
  const emojisByCategory = useAtomValue(emojisByCategoryAtom);
  const isLoadingEmojis = useAtomValue(emojiLoadingAtom);
  const fetchEmojis = useSetAtom(fetchEmojisAtom);

  // Load recent emojis from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load recent emojis:", error);
    }
  }, []);

  // Fetch custom emojis on mount
  useEffect(() => {
    fetchEmojis();
  }, [fetchEmojis]);

  // Reset visible count when category changes
  useEffect(() => {
    setVisibleCount(EMOJIS_PER_PAGE);
  }, [selectedCategory, selectedCustomCategory, searchQuery]);

  // Handle scroll to load more emojis
  const handleScroll = useCallback(() => {
    if (!emojiGridRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = emojiGridRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      setVisibleCount((prev) => prev + EMOJIS_PER_PAGE);
    }
  }, []);

  // Save emoji to recent emojis
  const saveToRecent = useCallback((emoji: string) => {
    try {
      setRecentEmojis((prev) => {
        const updated = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, MAX_RECENT_EMOJIS);
        localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error("Failed to save recent emoji:", error);
    }
  }, []);

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      saveToRecent(emoji);
      onEmojiSelect(emoji);
      setIsOpen(false);
    },
    [saveToRecent, onEmojiSelect],
  );

  // Handle custom emoji click (inserts :name: format)
  const handleCustomEmojiClick = useCallback(
    (emoji: CustomEmoji) => {
      const emojiCode = `:${emoji.name}:`;
      saveToRecent(emojiCode);
      onEmojiSelect(emojiCode);
      setIsOpen(false);
    },
    [saveToRecent, onEmojiSelect],
  );

  // Check if currently viewing custom emojis
  const isCustomCategory = selectedCategory === "custom";

  // Get emojis for the selected category
  const getEmojisForCategory = useMemo((): string[] => {
    if (selectedCategory === "recent") {
      return recentEmojis;
    }
    if (isCustomCategory) {
      return []; // Custom emojis are handled separately
    }
    if (selectedCategory in EMOJI_CATEGORIES) {
      return [...EMOJI_CATEGORIES[selectedCategory as EmojiCategory].emojis];
    }
    return [];
  }, [selectedCategory, recentEmojis, isCustomCategory]);

  // Get custom emojis for current view (filtered by selected custom category)
  const getCustomEmojisForCategory = useMemo((): CustomEmoji[] => {
    if (!isCustomCategory) {
      return [];
    }
    if (selectedCustomCategory === null) {
      // Show all custom emojis
      return customEmojis;
    }
    // Show emojis for specific category
    return emojisByCategory.get(selectedCustomCategory) || [];
  }, [isCustomCategory, selectedCustomCategory, customEmojis, emojisByCategory]);

  // Filter emojis by search query
  const filteredEmojis = useMemo(() => {
    if (searchQuery) {
      return Object.values(EMOJI_CATEGORIES)
        .flatMap((cat) => cat.emojis)
        .filter((emoji) => emoji.includes(searchQuery));
    }
    return getEmojisForCategory;
  }, [searchQuery, getEmojisForCategory]);

  // Filter custom emojis by search query
  const filteredCustomEmojis = useMemo(() => {
    if (searchQuery) {
      return customEmojis.filter(
        (emoji) =>
          emoji.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emoji.aliases.some((alias) => alias.toLowerCase().includes(searchQuery.toLowerCase())),
      );
    }
    return getCustomEmojisForCategory;
  }, [searchQuery, customEmojis, getCustomEmojisForCategory]);

  // Paginated emojis for display
  const displayedEmojis = useMemo(
    () => filteredEmojis.slice(0, visibleCount),
    [filteredEmojis, visibleCount],
  );

  const displayedCustomEmojis = useMemo(
    () => filteredCustomEmojis.slice(0, visibleCount),
    [filteredCustomEmojis, visibleCount],
  );

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {trigger || (
        <Button
          variant="ghost"
          size="sm"
          isDisabled={isDisabled}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label="Add emoji"
        >
          <Smile className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </Button>
      )}
      <ModalOverlay className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <Modal className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[600px] flex flex-col">
          <Dialog className="flex flex-col h-full outline-none">
            {({ close }) => (
              <>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      <Trans>Emoji Picker</Trans>
                    </h2>
                    <button
                      onClick={close}
                      className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>

                  {/* Search */}
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t`Search emoji...`}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>

                {/* Category tabs */}
                {!searchQuery && (
                  <div className="flex gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                    {/* Custom emojis tab (if available) */}
                    {customEmojis.length > 0 && (
                      <button
                        onClick={() => setSelectedCategory("custom")}
                        className={`px-3 py-2 rounded-md text-lg transition-colors ${
                          selectedCategory === "custom"
                            ? "bg-primary-100 dark:bg-primary-900/30"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                        title="Custom Emojis"
                        aria-label="Custom Emojis"
                      >
                        <Sparkles className="w-5 h-5" />
                      </button>
                    )}
                    {recentEmojis.length > 0 && (
                      <button
                        onClick={() => setSelectedCategory("recent")}
                        className={`px-3 py-2 rounded-md text-lg transition-colors ${
                          selectedCategory === "recent"
                            ? "bg-primary-100 dark:bg-primary-900/30"
                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                        title={EMOJI_CATEGORIES.recent.name}
                        aria-label={EMOJI_CATEGORIES.recent.name}
                      >
                        {EMOJI_CATEGORIES.recent.icon}
                      </button>
                    )}
                    {(Object.keys(EMOJI_CATEGORIES) as EmojiCategory[])
                      .filter((cat) => cat !== "recent")
                      .map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`px-3 py-2 rounded-md text-lg transition-colors ${
                            selectedCategory === category
                              ? "bg-primary-100 dark:bg-primary-900/30"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                          title={EMOJI_CATEGORIES[category].name}
                          aria-label={EMOJI_CATEGORIES[category].name}
                        >
                          {EMOJI_CATEGORIES[category].icon}
                        </button>
                      ))}
                  </div>
                )}

                {/* Custom emoji category tabs (when custom category is selected) */}
                {!searchQuery && isCustomCategory && customCategories.length > 0 && (
                  <div className="flex gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                    <button
                      onClick={() => setSelectedCustomCategory(null)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        selectedCustomCategory === null
                          ? "bg-primary-500 text-white"
                          : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <Trans>All</Trans>
                    </button>
                    {customCategories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCustomCategory(category)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                          selectedCustomCategory === category
                            ? "bg-primary-500 text-white"
                            : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                    {/* Show uncategorized if exists */}
                    {emojisByCategory.has("") && (
                      <button
                        onClick={() => setSelectedCustomCategory("")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                          selectedCustomCategory === ""
                            ? "bg-primary-500 text-white"
                            : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        <Trans>Uncategorized</Trans>
                      </button>
                    )}
                  </div>
                )}

                {/* Emoji grid */}
                <div
                  ref={emojiGridRef}
                  className="flex-1 overflow-y-auto p-4"
                  onScroll={handleScroll}
                >
                  {/* Loading state */}
                  {isLoadingEmojis && isCustomCategory && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  )}

                  {/* Custom emojis when searching or custom category selected */}
                  {displayedCustomEmojis.length > 0 && (
                    <>
                      {searchQuery && (
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                          <Trans>Custom Emojis</Trans>
                          <span className="ml-1 text-xs">({filteredCustomEmojis.length})</span>
                        </h3>
                      )}
                      <div className="grid grid-cols-8 gap-2 mb-4">
                        {displayedCustomEmojis.map((emoji) => (
                          <button
                            key={emoji.id}
                            onClick={() => handleCustomEmojiClick(emoji)}
                            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title={`:${emoji.name}:`}
                            aria-label={`Select :${emoji.name}:`}
                          >
                            <img
                              src={getProxiedImageUrl(emoji.url) || ""}
                              alt={`:${emoji.name}:`}
                              className="w-6 h-6 object-contain"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                      {/* Show load more indicator */}
                      {displayedCustomEmojis.length < filteredCustomEmojis.length && (
                        <div className="text-center py-2 text-xs text-gray-400">
                          <Trans>Scroll for more...</Trans> ({displayedCustomEmojis.length}/
                          {filteredCustomEmojis.length})
                        </div>
                      )}
                    </>
                  )}

                  {/* Unicode emojis */}
                  {displayedEmojis.length > 0 && (
                    <>
                      {searchQuery && displayedCustomEmojis.length > 0 && (
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                          <Trans>Standard Emojis</Trans>
                          <span className="ml-1 text-xs">({filteredEmojis.length})</span>
                        </h3>
                      )}
                      <div className="grid grid-cols-8 gap-2">
                        {displayedEmojis.map((emoji, index) => (
                          <button
                            key={`${emoji}-${index}`}
                            onClick={() => handleEmojiClick(emoji)}
                            className="text-2xl p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title={emoji}
                            aria-label={`Select ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      {/* Show load more indicator */}
                      {displayedEmojis.length < filteredEmojis.length && (
                        <div className="text-center py-2 text-xs text-gray-400">
                          <Trans>Scroll for more...</Trans> ({displayedEmojis.length}/
                          {filteredEmojis.length})
                        </div>
                      )}
                    </>
                  )}

                  {/* Empty state */}
                  {displayedEmojis.length === 0 && displayedCustomEmojis.length === 0 && !isLoadingEmojis && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                      <Smile className="w-12 h-12 mb-2" />
                      <p className="text-sm">
                        <Trans>No emojis found</Trans>
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

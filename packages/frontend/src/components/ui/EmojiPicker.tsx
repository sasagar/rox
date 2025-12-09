"use client";

import { useState, useRef, useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
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
} from "lucide-react";
import { Button } from "./Button";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "react-aria-components";
import {
  emojiListAtom,
  emojiCategoriesAtom,
  fetchEmojisAtom,
  type CustomEmoji,
} from "../../lib/atoms/customEmoji";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";

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
  const [selectedCategory, setSelectedCategory] = useState<EmojiCategory | "custom">("smileys");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Custom emoji state
  const [customEmojis] = useAtom(emojiListAtom);
  const [_customCategories] = useAtom(emojiCategoriesAtom); // Reserved for future category filtering
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

  // Save emoji to recent emojis
  const saveToRecent = (emoji: string) => {
    try {
      const updated = [emoji, ...recentEmojis.filter((e) => e !== emoji)].slice(
        0,
        MAX_RECENT_EMOJIS,
      );
      setRecentEmojis(updated);
      localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error("Failed to save recent emoji:", error);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    saveToRecent(emoji);
    onEmojiSelect(emoji);
    setIsOpen(false);
  };

  // Handle custom emoji click (inserts :name: format)
  const handleCustomEmojiClick = (emoji: CustomEmoji) => {
    const emojiCode = `:${emoji.name}:`;
    saveToRecent(emojiCode);
    onEmojiSelect(emojiCode);
    setIsOpen(false);
  };

  // Get emojis for the selected category
  const getEmojisForCategory = (): string[] => {
    if (selectedCategory === "recent") {
      return recentEmojis;
    }
    if (selectedCategory === "custom") {
      return []; // Custom emojis are handled separately
    }
    return [...EMOJI_CATEGORIES[selectedCategory].emojis];
  };

  // Get custom emojis for current view
  const getCustomEmojisForCategory = (): CustomEmoji[] => {
    if (selectedCategory !== "custom") {
      return [];
    }
    return customEmojis;
  };

  // Filter emojis by search query
  const filteredEmojis = searchQuery
    ? Object.values(EMOJI_CATEGORIES)
        .flatMap((cat) => cat.emojis)
        .filter((emoji) => emoji.includes(searchQuery))
    : getEmojisForCategory();

  // Filter custom emojis by search query
  const filteredCustomEmojis = searchQuery
    ? customEmojis.filter(
        (emoji) =>
          emoji.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emoji.aliases.some((alias) => alias.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : getCustomEmojisForCategory();

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

                {/* Emoji grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Custom emojis when searching or custom category selected */}
                  {filteredCustomEmojis.length > 0 && (
                    <>
                      {searchQuery && (
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                          <Trans>Custom Emojis</Trans>
                        </h3>
                      )}
                      <div className="grid grid-cols-8 gap-2 mb-4">
                        {filteredCustomEmojis.map((emoji) => (
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
                    </>
                  )}

                  {/* Unicode emojis */}
                  {filteredEmojis.length > 0 && (
                    <>
                      {searchQuery && filteredCustomEmojis.length > 0 && (
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                          <Trans>Standard Emojis</Trans>
                        </h3>
                      )}
                      <div className="grid grid-cols-8 gap-2">
                        {filteredEmojis.map((emoji, index) => (
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
                    </>
                  )}

                  {/* Empty state */}
                  {filteredEmojis.length === 0 && filteredCustomEmojis.length === 0 && (
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

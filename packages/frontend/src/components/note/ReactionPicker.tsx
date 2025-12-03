"use client";

import { useState } from "react";
import { Button } from "react-aria-components";
import { SmilePlus } from "lucide-react";

/**
 * Default reaction emojis
 * Common reactions used in social networks
 */
const DEFAULT_REACTIONS = [
  "👍", // Thumbs up
  "❤️", // Heart
  "😂", // Laughing
  "🎉", // Party
  "🤔", // Thinking
  "👀", // Eyes
  "🔥", // Fire
  "✨", // Sparkles
];

/**
 * ReactionPicker component props
 */
export interface ReactionPickerProps {
  /**
   * Callback when a reaction is selected
   */
  onReactionSelect: (reaction: string) => void;

  /**
   * Custom reactions to display (defaults to DEFAULT_REACTIONS)
   */
  reactions?: string[];

  /**
   * Currently selected reactions (for highlighting)
   */
  selectedReactions?: string[];
}

/**
 * ReactionPicker component
 * Displays a grid of reaction emojis for users to select from
 *
 * @example
 * ```tsx
 * <ReactionPicker
 *   onReactionSelect={(reaction) => console.log('Selected:', reaction)}
 *   selectedReactions={['👍', '❤️']}
 * />
 * ```
 */
export function ReactionPicker({
  onReactionSelect,
  reactions = DEFAULT_REACTIONS,
  selectedReactions = [],
}: ReactionPickerProps) {
  return (
    <div className="flex flex-wrap gap-1 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
      {reactions.map((reaction) => {
        const isSelected = selectedReactions.includes(reaction);

        return (
          <Button
            key={reaction}
            onPress={() => onReactionSelect(reaction)}
            className={`
              w-10 h-10 flex items-center justify-center text-2xl rounded-md
              transition-all hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-700
              ${isSelected ? "bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500" : "bg-gray-50 dark:bg-gray-700"}
            `}
          >
            {reaction}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * ReactionButton component
 * A button that shows a reaction picker when clicked
 *
 * @example
 * ```tsx
 * <ReactionButton
 *   onReactionSelect={(reaction) => handleReaction(reaction)}
 * />
 * ```
 */
export interface ReactionButtonProps {
  /**
   * Callback when a reaction is selected
   */
  onReactionSelect: (reaction: string) => void;

  /**
   * Currently selected reactions (for highlighting in picker)
   */
  selectedReactions?: string[];

  /**
   * Whether the button is disabled
   */
  isDisabled?: boolean;
}

export function ReactionButton({
  onReactionSelect,
  selectedReactions = [],
  isDisabled = false,
}: ReactionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleReactionSelect = (reaction: string) => {
    onReactionSelect(reaction);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Button
        onPress={() => setIsOpen(!isOpen)}
        isDisabled={isDisabled}
        className="
          flex items-center gap-1 px-3 py-1.5 rounded-full text-sm
          text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        "
        aria-label="Add reaction"
      >
        <SmilePlus className="w-4 h-4" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop to close picker */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Picker popover */}
          <div className="absolute bottom-full left-0 mb-2 z-20">
            <ReactionPicker
              onReactionSelect={handleReactionSelect}
              selectedReactions={selectedReactions}
            />
          </div>
        </>
      )}
    </div>
  );
}

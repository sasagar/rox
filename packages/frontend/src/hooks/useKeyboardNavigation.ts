import { useEffect, useRef, useCallback } from "react";

/**
 * Options for keyboard navigation
 */
export interface UseKeyboardNavigationOptions {
  /**
   * Whether keyboard navigation is enabled
   * @default true
   */
  enabled?: boolean;
  /**
   * CSS selector for navigable items
   * @default '[role="article"]'
   */
  itemSelector?: string;
  /**
   * Callback when an item is focused
   */
  onItemFocus?: (index: number) => void;
  /**
   * Callback when Enter is pressed on focused item
   */
  onItemActivate?: (index: number) => void;
}

/**
 * Hook for keyboard navigation in lists (e.g., timelines, feeds)
 *
 * Provides vim-style navigation with j/k keys:
 * - j: Move to next item
 * - k: Move to previous item
 * - Enter: Activate focused item
 *
 * @param containerRef - Ref to the container element
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function Timeline() {
 *   const containerRef = useRef<HTMLDivElement>(null);
 *
 *   useKeyboardNavigation(containerRef, {
 *     onItemActivate: (index) => {
 *       // Handle item activation
 *       console.log('Activated item:', index);
 *     }
 *   });
 *
 *   return (
 *     <div ref={containerRef}>
 *       {items.map(item => (
 *         <article key={item.id} role="article" tabIndex={-1}>
 *           {item.content}
 *         </article>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useKeyboardNavigation(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseKeyboardNavigationOptions = {},
) {
  const {
    enabled = true,
    itemSelector = '[role="article"]',
    onItemFocus,
    onItemActivate,
  } = options;

  const currentIndexRef = useRef<number>(-1);

  const getItems = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(itemSelector));
  }, [containerRef, itemSelector]);

  const focusItem = useCallback(
    (index: number) => {
      const items = getItems();
      if (index < 0 || index >= items.length) return;

      const item = items[index];
      if (!item) return;

      // Focus the item
      item.focus();

      // Scroll into view if needed
      item.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });

      currentIndexRef.current = index;
      onItemFocus?.(index);
    },
    [getItems, onItemFocus],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't handle keyboard navigation if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const items = getItems();
      if (items.length === 0) return;

      // Initialize current index if not set
      if (currentIndexRef.current === -1) {
        currentIndexRef.current = 0;
      }

      let handled = false;

      switch (event.key) {
        case "j":
        case "ArrowDown":
          // Move to next item
          event.preventDefault();
          if (currentIndexRef.current < items.length - 1) {
            focusItem(currentIndexRef.current + 1);
          }
          handled = true;
          break;

        case "k":
        case "ArrowUp":
          // Move to previous item
          event.preventDefault();
          if (currentIndexRef.current > 0) {
            focusItem(currentIndexRef.current - 1);
          }
          handled = true;
          break;

        case "Enter":
          // Activate current item
          if (currentIndexRef.current >= 0) {
            event.preventDefault();
            onItemActivate?.(currentIndexRef.current);
            handled = true;
          }
          break;

        case "Home":
          // Jump to first item
          event.preventDefault();
          focusItem(0);
          handled = true;
          break;

        case "End":
          // Jump to last item
          event.preventDefault();
          focusItem(items.length - 1);
          handled = true;
          break;
      }

      if (handled) {
        event.stopPropagation();
      }
    },
    [enabled, getItems, focusItem, onItemActivate],
  );

  useEffect(() => {
    if (!enabled) return;

    // Add keyboard event listener
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    focusItem,
    getCurrentIndex: () => currentIndexRef.current,
  };
}

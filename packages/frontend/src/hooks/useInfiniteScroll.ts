import { useEffect, useRef, useCallback } from "react";

/**
 * Options for useInfiniteScroll hook
 */
export interface UseInfiniteScrollOptions {
  /**
   * Callback function to load more items
   */
  onLoadMore: () => void | Promise<void>;
  /**
   * Whether currently loading
   */
  isLoading: boolean;
  /**
   * Whether there are more items to load
   */
  hasMore: boolean;
  /**
   * Intersection observer threshold (0.0 to 1.0)
   * @default 0.1
   */
  threshold?: number;
  /**
   * Root margin for the intersection observer
   * Positive values load content before the user reaches the trigger point
   * @default "100px"
   */
  rootMargin?: string;
  /**
   * Disabled flag to prevent loading
   * @default false
   */
  disabled?: boolean;
}

/**
 * Reusable infinite scroll hook using Intersection Observer API
 *
 * This hook provides an easy way to implement infinite scrolling in any component.
 * It observes a sentinel element and triggers the load more callback when the element
 * becomes visible in the viewport.
 *
 * @param options - Configuration options for infinite scroll behavior
 * @returns ref object to attach to the sentinel element
 *
 * @example
 * ```tsx
 * function MyList() {
 *   const [items, setItems] = useState([]);
 *   const [hasMore, setHasMore] = useState(true);
 *   const [isLoading, setIsLoading] = useState(false);
 *
 *   const loadMore = async () => {
 *     setIsLoading(true);
 *     const newItems = await fetchItems();
 *     setItems(prev => [...prev, ...newItems]);
 *     setHasMore(newItems.length > 0);
 *     setIsLoading(false);
 *   };
 *
 *   const sentinelRef = useInfiniteScroll({
 *     onLoadMore: loadMore,
 *     isLoading,
 *     hasMore,
 *   });
 *
 *   return (
 *     <div>
 *       {items.map(item => <Item key={item.id} {...item} />)}
 *       <div ref={sentinelRef} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useInfiniteScroll({
  onLoadMore,
  isLoading,
  hasMore,
  threshold = 0.1,
  rootMargin = "100px",
  disabled = false,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // Wrap onLoadMore in useCallback to ensure stable reference
  const stableOnLoadMore = useCallback(async () => {
    if (loadingRef.current || disabled) return;

    loadingRef.current = true;
    try {
      await onLoadMore();
    } finally {
      loadingRef.current = false;
    }
  }, [onLoadMore, disabled]);

  useEffect(() => {
    // Don't setup observer if disabled or no more items
    if (disabled || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Check if sentinel is visible and we're not already loading
        if (entries[0]?.isIntersecting && !isLoading && !loadingRef.current) {
          stableOnLoadMore();
        }
      },
      {
        threshold,
        rootMargin,
      },
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [isLoading, hasMore, threshold, rootMargin, disabled, stableOnLoadMore]);

  return sentinelRef;
}

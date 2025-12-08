"use client";

import { useRef, useEffect, type ReactNode, type Key } from "react";

/**
 * Props for AnimatedList component
 */
export interface AnimatedListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Function to get unique key for each item */
  keyExtractor: (item: T) => Key;
  /** Render function for each item */
  renderItem: (item: T, index: number) => ReactNode;
  /** CSS class for the container */
  className?: string;
  /** Animation duration in milliseconds */
  animationDuration?: number;
}

/**
 * AnimatedList component
 *
 * Renders a list with smooth entrance animations for new items.
 * Items slide in from the top with a fade effect when added.
 *
 * @example
 * ```tsx
 * <AnimatedList
 *   items={notes}
 *   keyExtractor={(note) => note.id}
 *   renderItem={(note) => <NoteCard note={note} />}
 * />
 * ```
 */
export function AnimatedList<T>({
  items,
  keyExtractor,
  renderItem,
  className = "",
  animationDuration = 300,
}: AnimatedListProps<T>) {
  // Track which items we've seen before
  const seenKeysRef = useRef<Set<Key>>(new Set());
  const isInitialRenderRef = useRef(true);

  // Update seen keys after render
  useEffect(() => {
    const currentKeys = new Set(items.map(keyExtractor));
    seenKeysRef.current = currentKeys;

    // After first render, mark as not initial
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
    }
  }, [items, keyExtractor]);

  return (
    <div className={className}>
      {items.map((item, index) => {
        const key = keyExtractor(item);
        const isNew = !isInitialRenderRef.current && !seenKeysRef.current.has(key);

        return (
          <div
            key={key}
            className={isNew ? "animate-slide-in-down" : ""}
            style={{
              animationDuration: isNew ? `${animationDuration}ms` : undefined,
            }}
          >
            {renderItem(item, index)}
          </div>
        );
      })}
    </div>
  );
}

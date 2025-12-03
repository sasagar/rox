import { useEffect, useRef, useCallback } from "react";

/**
 * Options for focus trap
 */
export interface UseFocusTrapOptions {
  /**
   * Whether the focus trap is active
   * @default true
   */
  active?: boolean;
  /**
   * Element to focus initially when trap activates
   * If not provided, focuses the first focusable element
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * Element to return focus to when trap deactivates
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * Callback when Escape key is pressed
   */
  onEscape?: () => void;
}

/**
 * Hook for trapping focus within a container (for modals, dialogs, etc.)
 *
 * This hook ensures that keyboard focus remains within the container element,
 * preventing users from tabbing out of modals or dialogs. It also:
 * - Saves and restores focus when the trap is activated/deactivated
 * - Handles Escape key to close the dialog
 * - Cycles focus between first and last focusable elements
 *
 * @param containerRef - Ref to the container element
 * @param options - Configuration options
 *
 * @example
 * ```tsx
 * function Modal({ onClose }: { onClose: () => void }) {
 *   const modalRef = useRef<HTMLDivElement>(null);
 *   const closeButtonRef = useRef<HTMLButtonElement>(null);
 *
 *   useFocusTrap(modalRef, {
 *     initialFocusRef: closeButtonRef,
 *     onEscape: onClose,
 *   });
 *
 *   return (
 *     <div ref={modalRef} role="dialog" aria-modal="true">
 *       <h2>Modal Title</h2>
 *       <p>Modal content</p>
 *       <button ref={closeButtonRef} onClick={onClose}>Close</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions = {},
) {
  const { active = true, initialFocusRef, returnFocusRef, onEscape } = options;

  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];

    const selector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(selector)).filter((el) => {
      // Filter out elements that are hidden or have display: none
      return el.offsetParent !== null && window.getComputedStyle(el).visibility !== "hidden";
    });
  }, [containerRef]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!active) return;

      // Handle Escape key
      if (event.key === "Escape") {
        event.preventDefault();
        onEscape?.();
        return;
      }

      // Handle Tab key for focus trapping
      if (event.key === "Tab") {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          // Shift + Tab: Move focus backwards
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab: Move focus forwards
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    },
    [active, getFocusableElements, onEscape],
  );

  useEffect(() => {
    if (!active) return;

    // Save currently focused element
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    // Focus initial element or first focusable element
    const focusableElements = getFocusableElements();
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    } else if (focusableElements.length > 0) {
      focusableElements[0]?.focus();
    }

    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup function
    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      // Restore focus to previously focused element or return focus element
      const elementToFocus = returnFocusRef?.current || previouslyFocusedElement.current;
      if (elementToFocus && typeof elementToFocus.focus === "function") {
        elementToFocus.focus();
      }
    };
  }, [active, initialFocusRef, returnFocusRef, getFocusableElements, handleKeyDown]);
}

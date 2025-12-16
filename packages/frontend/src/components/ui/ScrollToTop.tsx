"use client";

/**
 * ScrollToTop Component
 *
 * A floating button that appears when the user scrolls down
 * and allows them to quickly scroll back to the top of the page.
 * Built with React Aria Components for accessibility.
 */

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "react-aria-components";

interface ScrollToTopProps {
  /** Scroll threshold before showing the button (in pixels) */
  threshold?: number;
}

/**
 * A floating button that appears after scrolling down
 * and scrolls the page back to top when clicked.
 *
 * @param threshold - How far to scroll before showing button (default: 400)
 */
export function ScrollToTop({ threshold = 400 }: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > threshold);
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Button
      onPress={scrollToTop}
      className="fixed scroll-to-top-safe right-4 lg:right-6 z-30 p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      aria-label="Scroll to top"
    >
      <ArrowUp className="w-5 h-5" />
    </Button>
  );
}

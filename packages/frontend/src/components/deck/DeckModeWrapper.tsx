"use client";

import { useAtomValue } from "jotai";
import { deckEnabledAtom } from "../../lib/atoms/deck";
import { DeckLayout } from "./DeckLayout";

/**
 * Props for the DeckModeWrapper component
 */
export interface DeckModeWrapperProps {
  /** Normal page content to render when deck mode is disabled */
  children: React.ReactNode;
}

/**
 * Wrapper component that conditionally renders DeckLayout or normal content
 * based on the deckEnabled user setting.
 *
 * When deck mode is enabled, the children are not rendered and DeckLayout
 * takes over the entire view with multi-column display.
 *
 * @param children - Normal page content (shown when deck mode is disabled)
 */
export function DeckModeWrapper({ children }: DeckModeWrapperProps) {
  const deckEnabled = useAtomValue(deckEnabledAtom);

  if (deckEnabled) {
    return <DeckLayout />;
  }

  return <>{children}</>;
}

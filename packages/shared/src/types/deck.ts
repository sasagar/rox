/**
 * Deck feature type definitions
 *
 * The deck feature allows users to view multiple timelines and lists side-by-side.
 */

/**
 * Column types available in the deck
 */
export type DeckColumnType =
  | "timeline"
  | "notifications"
  | "mentions"
  | "list";

/**
 * Timeline types for timeline columns
 */
export type TimelineType = "home" | "local" | "social" | "global";

/**
 * Configuration for timeline columns
 */
export interface TimelineColumnConfig {
  type: "timeline";
  timelineType: TimelineType;
}

/**
 * Configuration for notification columns
 */
export interface NotificationsColumnConfig {
  type: "notifications";
  /** Filter by notification types (optional) */
  includeTypes?: string[];
}

/**
 * Configuration for mentions columns
 */
export interface MentionsColumnConfig {
  type: "mentions";
}

/**
 * Configuration for list columns
 */
export interface ListColumnConfig {
  type: "list";
  listId: string;
  listName?: string;
}

/**
 * Union type for all column configurations
 */
export type DeckColumnConfig =
  | TimelineColumnConfig
  | NotificationsColumnConfig
  | MentionsColumnConfig
  | ListColumnConfig;

/**
 * Column width options
 */
export type DeckColumnWidth = "narrow" | "normal" | "wide";

/**
 * Represents a single column in the deck
 */
export interface DeckColumn {
  /** Unique column identifier */
  id: string;
  /** Column configuration */
  config: DeckColumnConfig;
  /** Column display width */
  width: DeckColumnWidth;
}

/**
 * Represents a saved deck profile/layout
 */
export interface DeckProfile {
  /** Unique profile identifier */
  id: string;
  /** User-defined profile name */
  name: string;
  /** Columns in this profile */
  columns: DeckColumn[];
  /** Whether this is the user's default profile */
  isDefault: boolean;
  /** Profile creation timestamp */
  createdAt?: string;
  /** Profile last update timestamp */
  updatedAt?: string;
}

/**
 * Data for creating a new deck profile
 */
export interface CreateDeckProfileInput {
  name: string;
  columns: DeckColumn[];
  isDefault?: boolean;
}

/**
 * Data for updating an existing deck profile
 */
export interface UpdateDeckProfileInput {
  name?: string;
  columns?: DeckColumn[];
  isDefault?: boolean;
}

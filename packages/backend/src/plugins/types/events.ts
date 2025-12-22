/**
 * Event Types for Rox Plugin System
 *
 * This module defines all lifecycle events that plugins can subscribe to.
 * Events follow a naming convention: {resource}:{timing}{Action}
 *
 * - "before" events allow cancellation or modification of the operation
 * - "after" events are notifications only (fire-and-forget)
 */

import type { Note } from "../../db/schema/pg";

/**
 * Result type for "before" event handlers
 * Allows handlers to cancel or modify the operation
 *
 * @template T - The type of data being modified
 *
 * @example
 * ```ts
 * // Cancel the operation
 * return { cancel: true, reason: "Content violates policy" };
 *
 * // Modify the data
 * return { modified: { ...data, content: sanitize(data.content) } };
 *
 * // Allow operation to proceed unchanged
 * return {};
 * ```
 */
export type BeforeEventResult<T> =
  | { cancel: true; reason?: string }
  | { modified: T }
  | { cancel?: false; modified?: undefined };

// ============================================================================
// Note Events
// ============================================================================

/**
 * Data passed to note:beforeCreate event handlers
 */
export interface NoteBeforeCreateData {
  /** Note content text */
  content: string;
  /** User ID of the note author */
  userId: string;
  /** Content warning text (optional) */
  cw?: string | null;
  /** Visibility level */
  visibility?: "public" | "home" | "followers" | "specified";
  /** Local-only flag */
  localOnly?: boolean;
}

/**
 * Fired before a note is created
 * Handlers can cancel or modify the note data
 */
export interface NoteBeforeCreateEvent {
  type: "note:beforeCreate";
  data: NoteBeforeCreateData;
}

/**
 * Fired after a note is successfully created
 * Handlers receive the created note (notification only)
 */
export interface NoteAfterCreateEvent {
  type: "note:afterCreate";
  data: {
    note: Note;
  };
}

/**
 * Fired before a note is deleted
 * Handlers can cancel the deletion
 */
export interface NoteBeforeDeleteEvent {
  type: "note:beforeDelete";
  data: {
    noteId: string;
    userId: string;
  };
}

/**
 * Fired after a note is successfully deleted
 * Handlers receive the deleted note ID (notification only)
 */
export interface NoteAfterDeleteEvent {
  type: "note:afterDelete";
  data: {
    noteId: string;
    userId: string;
  };
}

// ============================================================================
// User Events
// ============================================================================

/**
 * Data passed to user:beforeRegister event handlers
 */
export interface UserBeforeRegisterData {
  /** Username for the new account */
  username: string;
  /** Email address (if provided) */
  email?: string | null;
}

/**
 * Fired before a user registration
 * Handlers can cancel or modify the registration data
 */
export interface UserBeforeRegisterEvent {
  type: "user:beforeRegister";
  data: UserBeforeRegisterData;
}

/**
 * Fired after a user is successfully registered
 * Handlers receive the new user ID (notification only)
 */
export interface UserAfterRegisterEvent {
  type: "user:afterRegister";
  data: {
    userId: string;
    username: string;
  };
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * Union of all "before" events (cancellable/modifiable)
 */
export type BeforeEvent =
  | NoteBeforeCreateEvent
  | NoteBeforeDeleteEvent
  | UserBeforeRegisterEvent;

/**
 * Union of all "after" events (notification only)
 */
export type AfterEvent =
  | NoteAfterCreateEvent
  | NoteAfterDeleteEvent
  | UserAfterRegisterEvent;

/**
 * Union of all Rox events
 */
export type RoxEvent = BeforeEvent | AfterEvent;

/**
 * Extract event data type from event type string
 */
export type EventDataMap = {
  "note:beforeCreate": NoteBeforeCreateData;
  "note:afterCreate": NoteAfterCreateEvent["data"];
  "note:beforeDelete": NoteBeforeDeleteEvent["data"];
  "note:afterDelete": NoteAfterDeleteEvent["data"];
  "user:beforeRegister": UserBeforeRegisterData;
  "user:afterRegister": UserAfterRegisterEvent["data"];
};

/**
 * Event type strings for "before" events
 */
export type BeforeEventType = BeforeEvent["type"];

/**
 * Event type strings for "after" events
 */
export type AfterEventType = AfterEvent["type"];

/**
 * All event type strings
 */
export type RoxEventType = RoxEvent["type"];

import type { ID, Timestamps, Visibility } from "./common.js";

/**
 * Scheduled note status
 */
export type ScheduledNoteStatus = "pending" | "published" | "failed" | "cancelled";

/**
 * Scheduled note record
 */
export interface ScheduledNote extends Timestamps {
  id: ID;
  userId: ID;
  text: string | null;
  cw: string | null;
  visibility: Visibility;
  localOnly: boolean;
  replyId: ID | null;
  renoteId: ID | null;
  fileIds: string[];
  scheduledAt: Date;
  status: ScheduledNoteStatus;
  publishedNoteId: ID | null;
  errorMessage: string | null;
}

/**
 * Input for creating a scheduled note
 */
export interface ScheduledNoteCreateInput {
  userId: ID;
  text?: string | null;
  cw?: string | null;
  visibility?: Visibility;
  localOnly?: boolean;
  replyId?: ID | null;
  renoteId?: ID | null;
  fileIds?: string[];
  scheduledAt: Date;
}

/**
 * Input for updating a scheduled note
 */
export interface ScheduledNoteUpdateInput {
  text?: string | null;
  cw?: string | null;
  visibility?: Visibility;
  localOnly?: boolean;
  replyId?: ID | null;
  renoteId?: ID | null;
  fileIds?: string[];
  scheduledAt?: Date;
}

/**
 * Response for scheduled note count endpoint
 */
export interface ScheduledNoteCountResponse {
  /** Current count of pending scheduled notes */
  count: number;
  /** Maximum allowed scheduled notes (-1 for unlimited) */
  limit: number;
  /** Remaining slots (-1 for unlimited) */
  remaining: number;
}

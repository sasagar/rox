import type { ID, Timestamps, Visibility } from './common.js';

export interface Note extends Timestamps {
  id: ID;
  userId: ID;
  text: string | null;
  cw: string | null; // Content Warning
  visibility: Visibility;
  localOnly: boolean;
  replyId: ID | null;
  renoteId: ID | null;
  fileIds: string[]; // JSON array of file IDs
  mentions: string[]; // JSON array of user IDs
  emojis: string[]; // JSON array of emoji names
  tags: string[]; // JSON array of hashtags
  uri: string | null; // ActivityPub URI for remote notes
  // Soft delete fields for moderation
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedById: ID | null;
  deletionReason: string | null;
}

export interface NoteWithRelations extends Note {
  user?: {
    id: ID;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    host: string | null;
  };
  files?: Array<{
    id: ID;
    url: string;
    thumbnailUrl: string | null;
    type: string;
    comment: string | null;
  }>;
  reactionCounts?: Record<string, number>;
  myReaction?: string | null;
}

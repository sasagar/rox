import type { ID, Timestamps } from "./common.js";

export interface Reaction extends Timestamps {
  id: ID;
  userId: ID;
  noteId: ID;
  reaction: string; // Emoji name or Unicode emoji
  customEmojiUrl?: string; // URL for custom emoji image (for remote reactions)
}

import type { ID, Timestamps } from "./common.js";

export type FileSource = "user" | "system";

/**
 * Drive folder for organizing files
 */
export interface DriveFolder extends Timestamps {
  id: ID;
  userId: ID;
  parentId: ID | null;
  name: string;
}

export interface DriveFile extends Timestamps {
  id: ID;
  userId: ID;
  folderId: ID | null;
  name: string;
  type: string; // MIME type
  size: number;
  md5: string;
  url: string;
  thumbnailUrl: string | null;
  blurhash: string | null;
  comment: string | null;
  isSensitive: boolean;
  storageKey: string; // Internal storage identifier
  source: FileSource; // "user" for user uploads, "system" for system-acquired files
}

export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  userId: ID;
}

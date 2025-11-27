/**
 * Remote Note Service
 *
 * Handles processing and storing remote ActivityPub notes (posts).
 * Converts ActivityPub Note objects to local database records.
 *
 * @module services/ap/RemoteNoteService
 */

import type { INoteRepository } from '../../interfaces/repositories/INoteRepository.js';
import type { IUserRepository } from '../../interfaces/repositories/IUserRepository.js';
import type { Note } from 'shared';
import { generateId } from 'shared';
import { RemoteActorService } from './RemoteActorService.js';

/**
 * ActivityPub Note object
 */
interface APNote {
  '@context'?: string | string[];
  id: string;
  type: string;
  attributedTo: string | { id: string };
  content?: string;
  summary?: string; // Content Warning
  published?: string;
  to?: string | string[];
  cc?: string | string[];
  inReplyTo?: string | null;
  attachment?: Array<{
    type: string;
    mediaType: string;
    url: string;
    name?: string;
  }>;
  tag?: Array<{
    type: string;
    name?: string;
    href?: string;
  }>;
}

/**
 * Remote Note Service
 *
 * Processes incoming ActivityPub notes and stores them in the local database.
 */
export class RemoteNoteService {
  constructor(
    private noteRepository: INoteRepository,
    private userRepository: IUserRepository,
    private remoteActorService?: RemoteActorService
  ) {}

  /**
   * Process and store remote note
   *
   * Converts an ActivityPub Note to a local Note record.
   * Resolves the author and creates the note in the database.
   *
   * @param noteObject - ActivityPub Note object
   * @returns Created Note record
   *
   * @example
   * ```typescript
   * const service = new RemoteNoteService(noteRepo, userRepo);
   * const note = await service.processNote(apNoteObject);
   * ```
   */
  async processNote(noteObject: APNote): Promise<Note> {
    // Check if note already exists
    const existing = await this.noteRepository.findByUri(noteObject.id);
    if (existing) {
      console.log(`⚠️  Note already exists: ${noteObject.id}`);
      return existing;
    }

    // Resolve author (use injected service or create new instance for backward compatibility)
    const actorService = this.remoteActorService ?? new RemoteActorService(this.userRepository);
    const authorUri =
      typeof noteObject.attributedTo === 'string'
        ? noteObject.attributedTo
        : noteObject.attributedTo.id;

    const author = await actorService.resolveActor(authorUri);

    // Extract text content (strip HTML tags for now)
    const text = noteObject.content ? this.stripHtml(noteObject.content) : null;

    // Extract Content Warning
    const cw = noteObject.summary || null;

    // Determine visibility from to/cc fields
    const visibility = this.determineVisibility(noteObject.to, noteObject.cc);

    // Extract mentions (user IDs)
    const mentions = this.extractMentions(noteObject.tag);

    // Extract hashtags
    const tags = this.extractHashtags(noteObject.tag);

    // Find reply target
    let replyId: string | null = null;
    if (noteObject.inReplyTo) {
      const replyNote = await this.noteRepository.findByUri(noteObject.inReplyTo);
      replyId = replyNote?.id || null;
    }

    // Create note
    const note = await this.noteRepository.create({
      id: generateId(),
      userId: author.id,
      text,
      cw,
      visibility,
      localOnly: false, // Remote notes are never local-only
      replyId,
      renoteId: null, // TODO: Handle Announce activities separately
      fileIds: [], // TODO: Handle attachments
      mentions,
      emojis: [], // TODO: Extract custom emojis
      tags,
      uri: noteObject.id,
      isDeleted: false,
      deletedAt: null,
      deletedById: null,
      deletionReason: null,
    });

    console.log(
      `✅ Remote note created: ${noteObject.id} by ${author.username}@${author.host}`
    );

    return note;
  }

  /**
   * Strip HTML tags from content
   *
   * ActivityPub notes often contain HTML markup.
   * This function strips tags while preserving text content.
   *
   * @param html - HTML content
   * @returns Plain text
   */
  private stripHtml(html: string): string {
    // Simple HTML stripping (replace <br> with newlines, remove other tags)
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Determine visibility from to/cc fields
   *
   * Maps ActivityPub addressing to local visibility levels.
   *
   * @param to - ActivityPub "to" field
   * @param cc - ActivityPub "cc" field
   * @returns Visibility level
   */
  private determineVisibility(
    to?: string | string[],
    cc?: string | string[]
  ): 'public' | 'home' | 'followers' | 'specified' {
    const toArray = Array.isArray(to) ? to : to ? [to] : [];
    const ccArray = Array.isArray(cc) ? cc : cc ? [cc] : [];

    const PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';
    const AS_PUBLIC = 'as:Public';

    // Check if public
    if (toArray.includes(PUBLIC) || toArray.includes(AS_PUBLIC)) {
      return 'public';
    }

    if (ccArray.includes(PUBLIC) || ccArray.includes(AS_PUBLIC)) {
      return 'home'; // Unlisted (not in public timeline, but visible to everyone)
    }

    // If addressed to followers collection
    if (toArray.some((uri) => uri.endsWith('/followers'))) {
      return 'followers';
    }

    // Direct message
    return 'specified';
  }

  /**
   * Extract mention user IDs from tags
   *
   * Resolves mentioned users and returns their local IDs.
   *
   * @param tags - ActivityPub tags array
   * @returns Array of user IDs
   */
  private extractMentions(
    tags?: Array<{ type: string; name?: string; href?: string }>
  ): string[] {
    if (!tags) return [];

    const mentions: string[] = [];

    for (const tag of tags) {
      if (tag.type === 'Mention' && tag.href) {
        // TODO: Resolve mentioned user URI to local user ID
        // For now, we'll skip this and handle it later
        // mentions.push(userId);
      }
    }

    return mentions;
  }

  /**
   * Extract hashtags from tags
   *
   * @param tags - ActivityPub tags array
   * @returns Array of hashtag names (without #)
   */
  private extractHashtags(
    tags?: Array<{ type: string; name?: string; href?: string }>
  ): string[] {
    if (!tags) return [];

    const hashtags: string[] = [];

    for (const tag of tags) {
      if (tag.type === 'Hashtag' && tag.name) {
        // Remove # prefix if present
        const tagName = tag.name.startsWith('#') ? tag.name.slice(1) : tag.name;
        hashtags.push(tagName);
      }
    }

    return hashtags;
  }
}

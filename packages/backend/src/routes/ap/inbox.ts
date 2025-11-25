/**
 * ActivityPub Inbox Routes
 *
 * Handles incoming ActivityPub activities from remote servers.
 * Implements server-to-server (S2S) ActivityPub protocol.
 *
 * @module routes/ap/inbox
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { verifySignatureMiddleware } from '../../middleware/verifySignature.js';
import { RemoteActorService } from '../../services/ap/RemoteActorService.js';
import { ActivityDeliveryService } from '../../services/ap/ActivityDeliveryService.js';
import { RemoteNoteService } from '../../services/ap/RemoteNoteService.js';

const inbox = new Hono();

/**
 * POST /users/:username/inbox
 *
 * Receives ActivityPub activities from remote servers.
 * All requests must be signed with HTTP Signatures.
 *
 * @param username - Username of the recipient
 * @returns 202 Accepted (activity queued for processing)
 *
 * @example
 * ```bash
 * curl -X POST https://example.com/users/alice/inbox \
 *   -H "Content-Type: application/activity+json" \
 *   -H "Signature: ..." \
 *   -d '{"type":"Follow","actor":"...","object":"..."}'
 * ```
 */
inbox.post('/users/:username/inbox', verifySignatureMiddleware, async (c: Context) => {
  const { username } = c.req.param();

  // Verify recipient exists
  const userRepository = c.get('userRepository');
  const user = await userRepository.findByUsername(username as string);

  if (!user || user.host !== null) {
    return c.notFound();
  }

  // Parse activity
  let activity: any;
  try {
    // Body may have been pre-read by signature verification middleware
    const preReadBody = c.get('requestBody');
    if (preReadBody) {
      activity = JSON.parse(preReadBody);
    } else {
      activity = await c.req.json();
    }
  } catch (error) {
    console.error('Failed to parse activity JSON:', error);
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  // Validate activity structure
  if (!activity.type || !activity.actor) {
    console.warn('Invalid activity structure:', activity);
    return c.json({ error: 'Invalid activity' }, 400);
  }

  console.log(`📥 Inbox: Received ${activity.type} from ${activity.actor} for ${username}`);

  // Handle activity based on type
  try {
    await handleActivity(c, activity, user.id);
  } catch (error) {
    console.error('Activity handling error:', error);
    // Return 202 even on errors (don't reveal internal errors to remote servers)
  }

  // Always return 202 Accepted
  return c.json({ status: 'accepted' }, 202);
});

/**
 * Handle incoming activity
 *
 * Routes activity to appropriate handler based on type.
 *
 * @param c - Hono context
 * @param activity - ActivityPub activity
 * @param recipientId - Local user ID
 */
async function handleActivity(c: Context, activity: any, recipientId: string): Promise<void> {
  switch (activity.type) {
    case 'Follow':
      await handleFollow(c, activity, recipientId);
      break;

    case 'Accept':
      await handleAccept(c, activity, recipientId);
      break;

    case 'Reject':
      await handleReject(c, activity, recipientId);
      break;

    case 'Create':
      await handleCreate(c, activity, recipientId);
      break;

    case 'Update':
      await handleUpdate(c, activity, recipientId);
      break;

    case 'Delete':
      await handleDelete(c, activity, recipientId);
      break;

    case 'Like':
      await handleLike(c, activity, recipientId);
      break;

    case 'Announce':
      await handleAnnounce(c, activity, recipientId);
      break;

    case 'Undo':
      await handleUndo(c, activity, recipientId);
      break;

    default:
      console.log(`Unsupported activity type: ${activity.type}`);
  }
}

/**
 * Handle Follow activity
 *
 * Processes incoming follow requests from remote users.
 * Creates a follow relationship and sends an Accept activity back.
 */
async function handleFollow(c: Context, activity: any, recipientId: string): Promise<void> {
  try {
    // Resolve remote actor
    const userRepository = c.get('userRepository');
    const remoteActorService = new RemoteActorService(userRepository);

    const actorUri = typeof activity.actor === 'string' ? activity.actor : activity.actor.id;
    const remoteActor = await remoteActorService.resolveActor(actorUri);

    console.log(`📥 Follow: ${remoteActor.username}@${remoteActor.host} → recipient ${recipientId}`);

    // Check if follow already exists
    const followRepository = c.get('followRepository');
    const alreadyFollowing = await followRepository.exists(remoteActor.id, recipientId);

    if (alreadyFollowing) {
      console.log(`⚠️  Follow already exists, skipping`);
      return;
    }

    // Create follow relationship
    const { generateId } = await import('shared');
    await followRepository.create({
      id: generateId(),
      followerId: remoteActor.id,
      followeeId: recipientId,
    });

    console.log(`✅ Follow created: ${remoteActor.username}@${remoteActor.host} → recipient`);

    // Send Accept activity back to remote server
    const recipient = await userRepository.findById(recipientId);
    if (!recipient || !recipient.privateKey) {
      console.error('Recipient not found or missing private key');
      return;
    }

    const baseUrl = process.env.URL || 'http://localhost:3000';
    const recipientUri = `${baseUrl}/users/${recipient.username}`;
    const keyId = `${recipientUri}#main-key`;

    const deliveryService = new ActivityDeliveryService();
    const acceptActivity = deliveryService.createAcceptActivity(activity, recipientUri);

    if (!remoteActor.inbox) {
      console.error('Remote actor has no inbox URL');
      return;
    }

    await deliveryService.deliver(
      acceptActivity,
      remoteActor.inbox,
      keyId,
      recipient.privateKey
    );

    console.log(`📤 Accept activity sent to ${remoteActor.inbox}`);
  } catch (error) {
    console.error('Failed to handle Follow activity:', error);
    throw error;
  }
}

/**
 * Handle Accept activity
 *
 * Processes acceptance of follow requests.
 */
async function handleAccept(_c: Context, _activity: any, _recipientId: string): Promise<void> {
  console.log('TODO: Implement Accept handler');
}

/**
 * Handle Reject activity
 *
 * Processes rejection of follow requests.
 */
async function handleReject(_c: Context, _activity: any, _recipientId: string): Promise<void> {
  console.log('TODO: Implement Reject handler');
}

/**
 * Handle Create activity
 *
 * Processes creation of new objects (notes, etc).
 * Stores remote posts in the local database.
 */
async function handleCreate(c: Context, activity: any, _recipientId: string): Promise<void> {
  try {
    // Extract object from activity
    const object = activity.object;

    if (!object || typeof object !== 'object') {
      console.warn('Invalid Create activity: missing or invalid object');
      return;
    }

    // Only handle Note objects for now
    if (object.type !== 'Note' && object.type !== 'Article') {
      console.log(`Unsupported object type: ${object.type}`);
      return;
    }

    console.log(`📥 Create: Receiving ${object.type} from ${activity.actor}`);

    // Process the note
    const noteRepository = c.get('noteRepository');
    const userRepository = c.get('userRepository');

    const remoteNoteService = new RemoteNoteService(noteRepository, userRepository);
    const note = await remoteNoteService.processNote(object);

    console.log(`✅ Note created: ${note.id} (URI: ${note.uri})`);
  } catch (error) {
    console.error('Failed to handle Create activity:', error);
    throw error;
  }
}

/**
 * Handle Update activity
 *
 * Processes updates to existing objects.
 */
async function handleUpdate(_c: Context, _activity: any, _recipientId: string): Promise<void> {
  console.log('TODO: Implement Update handler');
}

/**
 * Handle Delete activity
 *
 * Processes deletion of objects.
 */
async function handleDelete(_c: Context, _activity: any, _recipientId: string): Promise<void> {
  console.log('TODO: Implement Delete handler');
}

/**
 * Handle Like activity
 *
 * Processes likes/reactions to posts from remote users.
 */
async function handleLike(c: Context, activity: any, _recipientId: string): Promise<void> {
  try {
    // Extract object (the note being liked)
    const objectUri = typeof activity.object === 'string' ? activity.object : activity.object?.id;

    if (!objectUri) {
      console.warn('Invalid Like activity: missing object');
      return;
    }

    console.log(`📥 Like: ${activity.actor} → ${objectUri}`);

    // Resolve remote actor
    const userRepository = c.get('userRepository');
    const remoteActorService = new RemoteActorService(userRepository);

    const actorUri = typeof activity.actor === 'string' ? activity.actor : activity.actor.id;
    const remoteActor = await remoteActorService.resolveActor(actorUri);

    // Find the note being liked
    const noteRepository = c.get('noteRepository');
    const note = await noteRepository.findByUri(objectUri);

    if (!note) {
      console.warn(`Note not found: ${objectUri}`);
      return;
    }

    // Check if reaction already exists
    const reactionRepository = c.get('reactionRepository');
    const existingReaction = await reactionRepository.findByUserNoteAndReaction(
      remoteActor.id,
      note.id,
      '❤️' // Default to heart emoji for ActivityPub Like
    );

    if (existingReaction) {
      console.log(`⚠️  Reaction already exists, skipping`);
      return;
    }

    // Create reaction
    const { generateId } = await import('shared');
    await reactionRepository.create({
      id: generateId(),
      userId: remoteActor.id,
      noteId: note.id,
      reaction: '❤️', // ActivityPub Like maps to heart emoji
    });

    console.log(`✅ Reaction created: ${remoteActor.username}@${remoteActor.host} ❤️ note ${note.id}`);
  } catch (error) {
    console.error('Failed to handle Like activity:', error);
    throw error;
  }
}

/**
 * Handle Announce activity
 *
 * Processes boosts/reblogs/renotes from remote users.
 */
async function handleAnnounce(c: Context, activity: any, _recipientId: string): Promise<void> {
  try {
    // Extract object (the note being announced/boosted)
    const objectUri = typeof activity.object === 'string' ? activity.object : activity.object?.id;

    if (!objectUri) {
      console.warn('Invalid Announce activity: missing object');
      return;
    }

    console.log(`📥 Announce: ${activity.actor} → ${objectUri}`);

    // Resolve remote actor
    const userRepository = c.get('userRepository');
    const remoteActorService = new RemoteActorService(userRepository);

    const actorUri = typeof activity.actor === 'string' ? activity.actor : activity.actor.id;
    const remoteActor = await remoteActorService.resolveActor(actorUri);

    // Find or fetch the note being announced
    const noteRepository = c.get('noteRepository');
    let targetNote = await noteRepository.findByUri(objectUri);

    // If note doesn't exist locally, fetch it from remote
    if (!targetNote) {
      console.log(`Target note not found locally, fetching: ${objectUri}`);
      const remoteNoteService = new RemoteNoteService(noteRepository, userRepository);

      // Fetch the remote note object
      const response = await fetch(objectUri, {
        headers: {
          Accept: 'application/activity+json, application/ld+json',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch remote note: ${objectUri}`);
        return;
      }

      const noteObject = (await response.json()) as any;
      targetNote = await remoteNoteService.processNote(noteObject);
    }

    // Create a renote (quote without text = pure boost)
    const { generateId } = await import('shared');
    await noteRepository.create({
      id: generateId(),
      userId: remoteActor.id,
      text: null, // No text = pure boost
      cw: null,
      visibility: 'public',
      localOnly: false,
      replyId: null,
      renoteId: targetNote.id,
      fileIds: [],
      mentions: [],
      emojis: [],
      tags: [],
      uri: activity.id, // Use the Announce activity ID as the note URI
    });

    console.log(`✅ Renote created: ${remoteActor.username}@${remoteActor.host} announced note ${targetNote.id}`);
  } catch (error) {
    console.error('Failed to handle Announce activity:', error);
    throw error;
  }
}

/**
 * Handle Undo activity
 *
 * Processes undo operations (unfollow, unlike, etc).
 */
async function handleUndo(c: Context, activity: any, recipientId: string): Promise<void> {
  try {
    const object = activity.object;

    if (!object || typeof object !== 'object') {
      console.warn('Invalid Undo activity: missing or invalid object');
      return;
    }

    const userRepository = c.get('userRepository');
    const remoteActorService = new RemoteActorService(userRepository);

    const actorUri = typeof activity.actor === 'string' ? activity.actor : activity.actor.id;
    const remoteActor = await remoteActorService.resolveActor(actorUri);

    // Handle Undo Follow (unfollow)
    if (object.type === 'Follow') {
      console.log(`📥 Undo Follow: ${remoteActor.username}@${remoteActor.host} → recipient ${recipientId}`);

      // Delete follow relationship
      const followRepository = c.get('followRepository');
      await followRepository.delete(remoteActor.id, recipientId);

      console.log(`✅ Follow deleted: ${remoteActor.username}@${remoteActor.host} unfollowed recipient`);
    }
    // Handle Undo Like (unlike)
    else if (object.type === 'Like') {
      const objectUri = typeof object.object === 'string' ? object.object : object.object?.id;

      if (!objectUri) {
        console.warn('Invalid Undo Like: missing object');
        return;
      }

      console.log(`📥 Undo Like: ${remoteActor.username}@${remoteActor.host} → ${objectUri}`);

      // Find the note
      const noteRepository = c.get('noteRepository');
      const note = await noteRepository.findByUri(objectUri);

      if (!note) {
        console.warn(`Note not found: ${objectUri}`);
        return;
      }

      // Delete reaction
      const reactionRepository = c.get('reactionRepository');
      await reactionRepository.deleteByUserNoteAndReaction(remoteActor.id, note.id, '❤️');

      console.log(`✅ Reaction deleted: ${remoteActor.username}@${remoteActor.host} unliked note ${note.id}`);
    } else {
      console.log(`Unsupported Undo object type: ${object.type}`);
    }
  } catch (error) {
    console.error('Failed to handle Undo activity:', error);
    throw error;
  }
}

export default inbox;

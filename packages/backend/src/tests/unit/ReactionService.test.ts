/**
 * ReactionService Unit Tests
 *
 * Tests business logic for reaction operations
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { ReactionService } from '../../services/ReactionService';
import type { IReactionRepository } from '../../interfaces/repositories/IReactionRepository';
import type { INoteRepository } from '../../interfaces/repositories/INoteRepository';
import type { IUserRepository } from '../../interfaces/repositories/IUserRepository';
import type { ActivityPubDeliveryService } from '../../services/ap/ActivityPubDeliveryService';
import type { Reaction, Note } from 'shared';
import type { User } from '../../db/schema/pg.js';

/**
 * Partial mock types that only include the methods we actually use in tests
 */
type MockReactionRepo = Pick<
  IReactionRepository,
  'create' | 'findByUserNoteAndReaction' | 'deleteByUserNoteAndReaction' | 'findByNoteId' | 'countByNoteId' | 'countByNoteIds' | 'findByUserAndNoteAll'
>;

type MockNoteRepo = Pick<INoteRepository, 'findById'>;
type MockUserRepo = Pick<IUserRepository, 'findById'>;
type MockDeliveryService = Pick<ActivityPubDeliveryService, 'deliverLikeActivity' | 'deliverUndoLike'>;

describe('ReactionService', () => {
  // Mock data
  const mockReaction: Reaction = {
    id: 'reaction1',
    userId: 'user1',
    noteId: 'note1',
    reaction: '👍',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNote: Note = {
    id: 'note1',
    userId: 'author1',
    text: 'test',
    cw: null,
    visibility: 'public',
    localOnly: false,
    replyId: null,
    renoteId: null,
    fileIds: [],
    mentions: [],
    emojis: [],
    tags: [],
    uri: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser: Partial<User> = {
    id: 'user1',
    username: 'testuser',
    host: null,
  };

  // Mock repositories
  let mockReactionRepo: MockReactionRepo;
  let mockNoteRepo: MockNoteRepo;
  let mockUserRepo: MockUserRepo;
  let mockDeliveryService: MockDeliveryService;

  beforeEach(() => {
    mockReactionRepo = {
      create: mock(() => Promise.resolve(mockReaction)),
      findByUserNoteAndReaction: mock(() => Promise.resolve(null)),
      deleteByUserNoteAndReaction: mock(() => Promise.resolve()),
      findByNoteId: mock(() => Promise.resolve([])),
      countByNoteId: mock(() => Promise.resolve({})),
      countByNoteIds: mock(() => Promise.resolve(new Map())),
      findByUserAndNoteAll: mock(() => Promise.resolve([])),
    };

    mockNoteRepo = {
      findById: mock(() => Promise.resolve(mockNote)),
    };

    mockUserRepo = {
      findById: mock(() => Promise.resolve(mockUser as User)),
    };

    mockDeliveryService = {
      deliverLikeActivity: mock(() => Promise.resolve()),
      deliverUndoLike: mock(() => Promise.resolve()),
    };
  });

  test('should create a new reaction', async () => {
    const service = new ReactionService(
      mockReactionRepo as IReactionRepository,
      mockNoteRepo as INoteRepository,
      mockUserRepo as IUserRepository,
      mockDeliveryService as ActivityPubDeliveryService
    );

    const result = await service.create({
      userId: 'user1',
      noteId: 'note1',
      reaction: '👍',
    });

    expect(result.id).toBe('reaction1');
    expect(result.reaction).toBe('👍');
    expect(mockReactionRepo.findByUserNoteAndReaction).toHaveBeenCalled();
    expect(mockReactionRepo.create).toHaveBeenCalled();
  });

  test('should return existing reaction if already exists (idempotent)', async () => {
    const existingReaction: Reaction = {
      id: 'existing',
      userId: 'user1',
      noteId: 'note1',
      reaction: '👍',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create fresh mocks for this test
    const freshReactionRepo: MockReactionRepo = {
      ...mockReactionRepo,
      findByUserNoteAndReaction: mock(() => Promise.resolve(existingReaction)),
      create: mock(() => Promise.resolve(mockReaction)),
    };

    const service = new ReactionService(
      freshReactionRepo as IReactionRepository,
      mockNoteRepo as INoteRepository,
      mockUserRepo as IUserRepository,
      mockDeliveryService as ActivityPubDeliveryService
    );

    const result = await service.create({
      userId: 'user1',
      noteId: 'note1',
      reaction: '👍',
    });

    expect(result.id).toBe('existing');
    expect(freshReactionRepo.create).not.toHaveBeenCalled();
  });

  test('should reject empty reaction', async () => {
    const service = new ReactionService(
      mockReactionRepo as IReactionRepository,
      mockNoteRepo as INoteRepository,
      mockUserRepo as IUserRepository,
      mockDeliveryService as ActivityPubDeliveryService
    );

    await expect(
      service.create({
        userId: 'user1',
        noteId: 'note1',
        reaction: '',
      })
    ).rejects.toThrow('Reaction cannot be empty');
  });

  test('should reject reaction exceeding max length', async () => {
    const service = new ReactionService(
      mockReactionRepo as IReactionRepository,
      mockNoteRepo as INoteRepository,
      mockUserRepo as IUserRepository,
      mockDeliveryService as ActivityPubDeliveryService
    );

    const longReaction = 'x'.repeat(101);

    await expect(
      service.create({
        userId: 'user1',
        noteId: 'note1',
        reaction: longReaction,
      })
    ).rejects.toThrow('Reaction exceeds maximum length');
  });

  test('should reject reaction to non-existent note', async () => {
    const mockNoteRepoEmpty: MockNoteRepo = {
      findById: mock(() => Promise.resolve(null)),
    };

    const service = new ReactionService(
      mockReactionRepo as IReactionRepository,
      mockNoteRepoEmpty as INoteRepository,
      mockUserRepo as IUserRepository,
      mockDeliveryService as ActivityPubDeliveryService
    );

    await expect(
      service.create({
        userId: 'user1',
        noteId: 'nonexistent',
        reaction: '👍',
      })
    ).rejects.toThrow('Note not found');
  });

  test('should delete a reaction', async () => {
    const existingReaction: Reaction = {
      id: 'reaction1',
      userId: 'user1',
      noteId: 'note1',
      reaction: '👍',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockReactionRepoWithExisting: MockReactionRepo = {
      ...mockReactionRepo,
      findByUserNoteAndReaction: mock(() => Promise.resolve(existingReaction)),
    };

    const service = new ReactionService(
      mockReactionRepoWithExisting as IReactionRepository,
      mockNoteRepo as INoteRepository,
      mockUserRepo as IUserRepository,
      mockDeliveryService as ActivityPubDeliveryService
    );

    await service.delete('user1', 'note1', '👍');

    expect(mockReactionRepoWithExisting.deleteByUserNoteAndReaction).toHaveBeenCalledWith('user1', 'note1', '👍');
  });

  test('should reject deleting non-existent reaction', async () => {
    const mockReactionRepoEmpty: MockReactionRepo = {
      ...mockReactionRepo,
      findByUserNoteAndReaction: mock(() => Promise.resolve(null)),
    };

    const service = new ReactionService(
      mockReactionRepoEmpty as IReactionRepository,
      mockNoteRepo as INoteRepository,
      mockUserRepo as IUserRepository,
      mockDeliveryService as ActivityPubDeliveryService
    );

    await expect(
      service.delete('user1', 'note1', '👍')
    ).rejects.toThrow('Reaction not found');
  });

  test('should get reactions by note', async () => {
    const reactions: Reaction[] = [
      { id: 'r1', userId: 'u1', noteId: 'note1', reaction: '👍', createdAt: new Date(), updatedAt: new Date() },
      { id: 'r2', userId: 'u2', noteId: 'note1', reaction: '❤️', createdAt: new Date(), updatedAt: new Date() },
    ];

    const mockReactionRepoWithReactions: MockReactionRepo = {
      ...mockReactionRepo,
      findByNoteId: mock(() => Promise.resolve(reactions)),
    };

    const service = new ReactionService(
      mockReactionRepoWithReactions as IReactionRepository,
      mockNoteRepo as INoteRepository,
      mockUserRepo as IUserRepository,
      mockDeliveryService as ActivityPubDeliveryService
    );

    const result = await service.getReactionsByNote('note1');

    expect(result).toEqual(reactions);
    expect(mockReactionRepoWithReactions.findByNoteId).toHaveBeenCalledWith('note1', undefined);
  });

  test('should get reaction counts', async () => {
    const counts = { '👍': 5, '❤️': 3 };

    const mockReactionRepoWithCounts: MockReactionRepo = {
      ...mockReactionRepo,
      countByNoteId: mock(() => Promise.resolve(counts)),
    };

    const service = new ReactionService(
      mockReactionRepoWithCounts as IReactionRepository,
      mockNoteRepo as INoteRepository,
      mockUserRepo as IUserRepository,
      mockDeliveryService as ActivityPubDeliveryService
    );

    const result = await service.getReactionCounts('note1');

    expect(result).toEqual(counts);
    expect(mockReactionRepoWithCounts.countByNoteId).toHaveBeenCalledWith('note1');
  });
});

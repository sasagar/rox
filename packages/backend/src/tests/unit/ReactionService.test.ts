/**
 * ReactionService Unit Tests
 *
 * Tests business logic for reaction operations
 */

import { describe, test, expect, mock } from 'bun:test';
import { ReactionService } from '../../services/ReactionService';

describe('ReactionService', () => {
  // Mock repositories
  const mockReactionRepo = {
    create: mock(() => Promise.resolve({ id: 'reaction1', userId: 'user1', noteId: 'note1', reaction: '👍', createdAt: new Date() })),
    findByUserNoteAndReaction: mock(() => Promise.resolve(null)),
    deleteByUserNoteAndReaction: mock(() => Promise.resolve()),
    findByNoteId: mock(() => Promise.resolve([])),
    countByNoteId: mock(() => Promise.resolve({})),
    countByNoteIds: mock(() => Promise.resolve(new Map())),
    findByUserAndNoteAll: mock(() => Promise.resolve([])),
  };

  const mockNoteRepo = {
    findById: mock(() => Promise.resolve({ id: 'note1', userId: 'author1', text: 'test', createdAt: new Date() })),
  };

  const mockUserRepo = {
    findById: mock(() => Promise.resolve({ id: 'user1', username: 'testuser', host: null })),
  };

  const mockFollowRepo = {};
  const mockQueue = {};

  test('should create a new reaction', async () => {
    const service = new ReactionService(
      mockReactionRepo as any,
      mockNoteRepo as any,
      mockUserRepo as any,
      mockFollowRepo as any,
      mockQueue as any
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
    const existingReaction = { id: 'existing', userId: 'user1', noteId: 'note1', reaction: '👍', createdAt: new Date() };

    // Create fresh mocks for this test
    const freshReactionRepo = {
      ...mockReactionRepo,
      findByUserNoteAndReaction: mock(() => Promise.resolve(existingReaction)),
      create: mock(() => Promise.resolve({ id: 'reaction1', userId: 'user1', noteId: 'note1', reaction: '👍', createdAt: new Date() })),
    };

    const service = new ReactionService(
      freshReactionRepo as any,
      mockNoteRepo as any,
      mockUserRepo as any,
      mockFollowRepo as any,
      mockQueue as any
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
      mockReactionRepo as any,
      mockNoteRepo as any,
      mockUserRepo as any,
      mockFollowRepo as any,
      mockQueue as any
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
      mockReactionRepo as any,
      mockNoteRepo as any,
      mockUserRepo as any,
      mockFollowRepo as any,
      mockQueue as any
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
    mockNoteRepo.findById.mockResolvedValueOnce(null as any);

    const service = new ReactionService(
      mockReactionRepo as any,
      mockNoteRepo as any,
      mockUserRepo as any,
      mockFollowRepo as any,
      mockQueue as any
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
    const existingReaction = { id: 'reaction1', userId: 'user1', noteId: 'note1', reaction: '👍', createdAt: new Date(), updatedAt: new Date() };
    mockReactionRepo.findByUserNoteAndReaction.mockResolvedValueOnce(existingReaction as any);

    const service = new ReactionService(
      mockReactionRepo as any,
      mockNoteRepo as any,
      mockUserRepo as any,
      mockFollowRepo as any,
      mockQueue as any
    );

    await service.delete('user1', 'note1', '👍');

    expect(mockReactionRepo.deleteByUserNoteAndReaction).toHaveBeenCalledWith('user1', 'note1', '👍');
  });

  test('should reject deleting non-existent reaction', async () => {
    mockReactionRepo.findByUserNoteAndReaction.mockResolvedValueOnce(null);

    const service = new ReactionService(
      mockReactionRepo as any,
      mockNoteRepo as any,
      mockUserRepo as any,
      mockFollowRepo as any,
      mockQueue as any
    );

    await expect(
      service.delete('user1', 'note1', '👍')
    ).rejects.toThrow('Reaction not found');
  });

  test('should get reactions by note', async () => {
    const reactions = [
      { id: 'r1', userId: 'u1', noteId: 'note1', reaction: '👍', createdAt: new Date(), updatedAt: new Date() },
      { id: 'r2', userId: 'u2', noteId: 'note1', reaction: '❤️', createdAt: new Date(), updatedAt: new Date() },
    ];
    mockReactionRepo.findByNoteId.mockResolvedValueOnce(reactions as any);

    const service = new ReactionService(
      mockReactionRepo as any,
      mockNoteRepo as any,
      mockUserRepo as any,
      mockFollowRepo as any,
      mockQueue as any
    );

    const result = await service.getReactionsByNote('note1');

    expect(result).toEqual(reactions);
    expect(mockReactionRepo.findByNoteId).toHaveBeenCalledWith('note1', undefined);
  });

  test('should get reaction counts', async () => {
    const counts = { '👍': 5, '❤️': 3 };
    mockReactionRepo.countByNoteId.mockResolvedValueOnce(counts);

    const service = new ReactionService(
      mockReactionRepo as any,
      mockNoteRepo as any,
      mockUserRepo as any,
      mockFollowRepo as any,
      mockQueue as any
    );

    const result = await service.getReactionCounts('note1');

    expect(result).toEqual(counts);
    expect(mockReactionRepo.countByNoteId).toHaveBeenCalledWith('note1');
  });
});

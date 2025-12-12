/**
 * Verify Signature Middleware Unit Tests
 *
 * Tests the fetch failure caching functionality in the HTTP Signature verification middleware.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  clearFetchFailureCache,
  getFetchFailureCacheStats,
} from "../../middleware/verifySignature.js";

describe("verifySignature fetch failure cache", () => {
  beforeEach(() => {
    // Clear the cache before each test
    clearFetchFailureCache();
  });

  test("clearFetchFailureCache should clear all entries", () => {
    // Initially empty
    const stats = getFetchFailureCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.entries).toHaveLength(0);
  });

  test("getFetchFailureCacheStats should return empty stats when cache is empty", () => {
    const stats = getFetchFailureCacheStats();

    expect(stats.size).toBe(0);
    expect(stats.entries).toEqual([]);
  });

  test("getFetchFailureCacheStats should return correct structure", () => {
    const stats = getFetchFailureCacheStats();

    expect(stats).toHaveProperty("size");
    expect(stats).toHaveProperty("entries");
    expect(Array.isArray(stats.entries)).toBe(true);
  });
});

import type { RemoteInstance } from "shared";

/**
 * Repository interface for remote instance operations
 */
export interface IRemoteInstanceRepository {
  /**
   * Find instance by host
   */
  findByHost(host: string): Promise<RemoteInstance | null>;

  /**
   * Find multiple instances by hosts
   */
  findByHosts(hosts: string[]): Promise<RemoteInstance[]>;

  /**
   * Create or update instance info
   */
  upsert(instance: Partial<RemoteInstance> & { host: string }): Promise<RemoteInstance>;

  /**
   * Get all instances
   */
  findAll(options?: { limit?: number; offset?: number }): Promise<RemoteInstance[]>;

  /**
   * Get instances that need refresh (stale info)
   */
  findStale(olderThan: Date, limit?: number): Promise<RemoteInstance[]>;

  /**
   * Increment fetch error count
   */
  incrementErrorCount(host: string): Promise<void>;

  /**
   * Reset fetch error count
   */
  resetErrorCount(host: string): Promise<void>;

  /**
   * Delete instance
   */
  delete(host: string): Promise<void>;
}

import type { IRemoteInstanceRepository } from "../interfaces/repositories/IRemoteInstanceRepository.js";
import type { RemoteInstance, PublicRemoteInstance } from "shared";
import { logger } from "../lib/logger.js";
import { fetchInstanceIcon } from "../lib/instance-icon.js";

/**
 * NodeInfo 2.0/2.1 response structure
 */
interface NodeInfo {
  version: string;
  software: {
    name: string;
    version: string;
  };
  protocols: string[];
  usage?: {
    users?: {
      total?: number;
      activeMonth?: number;
      activeHalfyear?: number;
    };
    localPosts?: number;
  };
  openRegistrations?: boolean;
  metadata?: {
    nodeName?: string;
    nodeDescription?: string;
    themeColor?: string;
    [key: string]: unknown;
  };
}

/**
 * Well-known nodeinfo response
 */
interface WellKnownNodeInfo {
  links: Array<{
    rel: string;
    href: string;
  }>;
}

/**
 * Service for fetching and caching remote instance information
 */
export class RemoteInstanceService {
  // Cache TTL: 24 hours
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  // Maximum retry errors before giving up
  private static readonly MAX_ERROR_COUNT = 5;

  constructor(private remoteInstanceRepository: IRemoteInstanceRepository) {}

  /**
   * Get instance info, fetching from remote if not cached or stale
   */
  async getInstanceInfo(host: string): Promise<PublicRemoteInstance | null> {
    // Check cache first
    const cached = await this.remoteInstanceRepository.findByHost(host);

    if (cached) {
      // Return cached if still fresh
      if (cached.lastFetchedAt && this.isFresh(cached.lastFetchedAt)) {
        return this.toPublicInstance(cached);
      }

      // Skip if too many errors
      if (cached.fetchErrorCount >= RemoteInstanceService.MAX_ERROR_COUNT) {
        return this.toPublicInstance(cached);
      }
    }

    // Fetch fresh data
    try {
      const instance = await this.fetchAndCacheInstanceInfo(host);
      return instance ? this.toPublicInstance(instance) : null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ err: error, host }, "Failed to fetch instance info");

      // Increment error count with error message
      if (cached) {
        await this.remoteInstanceRepository.incrementErrorCount(host, errorMessage);
        return this.toPublicInstance(cached);
      }

      return null;
    }
  }

  /**
   * Force refresh instance info (for admin use)
   */
  async refreshInstanceInfo(host: string): Promise<RemoteInstance | null> {
    try {
      // Mark for refresh first
      await this.remoteInstanceRepository.markForRefresh(host);

      // Fetch fresh data
      const instance = await this.fetchAndCacheInstanceInfo(host);
      return instance;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn({ err: error, host }, "Failed to refresh instance info");

      // Store error message
      await this.remoteInstanceRepository.incrementErrorCount(host, errorMessage);

      // Return cached data with error
      return this.remoteInstanceRepository.findByHost(host);
    }
  }

  /**
   * Get all instances for admin (includes error info)
   */
  async getAllInstances(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ instances: RemoteInstance[]; total: number }> {
    const [instances, total] = await Promise.all([
      this.remoteInstanceRepository.findAll(options),
      this.remoteInstanceRepository.count(),
    ]);
    return { instances, total };
  }

  /**
   * Get instance info for multiple hosts
   */
  async getInstanceInfoBatch(hosts: string[]): Promise<Map<string, PublicRemoteInstance>> {
    const result = new Map<string, PublicRemoteInstance>();
    const uniqueHosts = [...new Set(hosts)];

    // Get all cached instances
    const cached = await this.remoteInstanceRepository.findByHosts(uniqueHosts);
    const cachedMap = new Map(cached.map((i) => [i.host, i]));

    // Identify which hosts need fresh fetch
    const hostsToFetch: string[] = [];

    for (const host of uniqueHosts) {
      const cachedInstance = cachedMap.get(host);

      if (cachedInstance) {
        result.set(host, this.toPublicInstance(cachedInstance));

        // Check if stale and needs refresh
        if (
          !cachedInstance.lastFetchedAt ||
          (!this.isFresh(cachedInstance.lastFetchedAt) &&
            cachedInstance.fetchErrorCount < RemoteInstanceService.MAX_ERROR_COUNT)
        ) {
          hostsToFetch.push(host);
        }
      } else {
        hostsToFetch.push(host);
      }
    }

    // Fetch missing/stale instances in background (don't wait)
    if (hostsToFetch.length > 0) {
      this.fetchInstancesInBackground(hostsToFetch).catch((err) => {
        logger.warn("Background instance fetch failed:", err);
      });
    }

    return result;
  }

  /**
   * Fetch and cache instance info from remote server
   */
  private async fetchAndCacheInstanceInfo(host: string): Promise<RemoteInstance | null> {
    const nodeInfo = await this.fetchNodeInfo(host);

    if (!nodeInfo) {
      // Create minimal entry to track fetch attempts
      return this.remoteInstanceRepository.upsert({
        host,
        lastFetchedAt: new Date(),
        fetchErrorCount: 1,
      });
    }

    // Try to fetch instance icon (using software-specific API, then favicon fallback)
    const iconUrl = await fetchInstanceIcon(host, nodeInfo.software.name);

    const instance = await this.remoteInstanceRepository.upsert({
      host,
      softwareName: nodeInfo.software.name,
      softwareVersion: nodeInfo.software.version,
      name: nodeInfo.metadata?.nodeName ?? null,
      description: nodeInfo.metadata?.nodeDescription ?? null,
      iconUrl,
      themeColor: nodeInfo.metadata?.themeColor ?? null,
      openRegistrations: nodeInfo.openRegistrations ?? null,
      usersCount: nodeInfo.usage?.users?.total ?? null,
      notesCount: nodeInfo.usage?.localPosts ?? null,
      lastFetchedAt: new Date(),
      fetchErrorCount: 0,
    });

    await this.remoteInstanceRepository.resetErrorCount(host);

    return instance;
  }

  /**
   * Fetch NodeInfo from a remote server
   */
  private async fetchNodeInfo(host: string): Promise<NodeInfo | null> {
    try {
      // First, fetch well-known nodeinfo to get the actual nodeinfo URL
      const wellKnownUrl = `https://${host}/.well-known/nodeinfo`;
      const wellKnownResponse = await fetch(wellKnownUrl, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!wellKnownResponse.ok) {
        return null;
      }

      const wellKnown = (await wellKnownResponse.json()) as WellKnownNodeInfo;

      // Find nodeinfo 2.1 or 2.0 link
      const nodeInfoLink = wellKnown.links.find(
        (link) =>
          link.rel === "http://nodeinfo.diaspora.software/ns/schema/2.1" ||
          link.rel === "http://nodeinfo.diaspora.software/ns/schema/2.0",
      );

      if (!nodeInfoLink) {
        return null;
      }

      // Fetch actual nodeinfo
      const nodeInfoResponse = await fetch(nodeInfoLink.href, {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!nodeInfoResponse.ok) {
        return null;
      }

      return (await nodeInfoResponse.json()) as NodeInfo;
    } catch (error) {
      logger.debug({ err: error, host }, "Failed to fetch nodeinfo");
      return null;
    }
  }

  /**
   * Fetch instances in background without blocking
   */
  private async fetchInstancesInBackground(hosts: string[]): Promise<void> {
    // Limit concurrent fetches
    const batchSize = 5;

    for (let i = 0; i < hosts.length; i += batchSize) {
      const batch = hosts.slice(i, i + batchSize);
      await Promise.allSettled(batch.map((host) => this.fetchAndCacheInstanceInfo(host)));
    }
  }

  /**
   * Check if cached data is still fresh
   */
  private isFresh(lastFetchedAt: Date): boolean {
    return Date.now() - lastFetchedAt.getTime() < RemoteInstanceService.CACHE_TTL_MS;
  }

  /**
   * Convert internal instance to public API format
   */
  private toPublicInstance(instance: RemoteInstance): PublicRemoteInstance {
    return {
      host: instance.host,
      softwareName: instance.softwareName,
      softwareVersion: instance.softwareVersion,
      name: instance.name,
      description: instance.description,
      iconUrl: instance.iconUrl,
      themeColor: instance.themeColor,
    };
  }
}

import type { IRemoteInstanceRepository } from "../interfaces/repositories/IRemoteInstanceRepository.js";
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
 * Configuration for the remote instance refresh service
 */
export interface RemoteInstanceRefreshConfig {
  /**
   * How often to run the refresh job (in milliseconds)
   * Default: 1 hour
   */
  intervalMs: number;

  /**
   * How old the cache must be before refreshing (in milliseconds)
   * Default: 24 hours
   */
  staleTTLMs: number;

  /**
   * Maximum number of instances to refresh per run
   * Default: 20
   */
  batchSize: number;

  /**
   * Maximum number of fetch errors before giving up on an instance
   * Default: 5
   */
  maxErrorCount: number;
}

/**
 * Background service for periodically refreshing remote instance information
 *
 * This service runs on a configurable interval and refreshes stale instance
 * information from remote servers using the NodeInfo protocol.
 */
export class RemoteInstanceRefreshService {
  private config: RemoteInstanceRefreshConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Create a new RemoteInstanceRefreshService
   *
   * @param remoteInstanceRepository - Repository for remote instance data
   * @param config - Optional configuration overrides
   */
  constructor(
    private remoteInstanceRepository: IRemoteInstanceRepository,
    config?: Partial<RemoteInstanceRefreshConfig>,
  ) {
    this.config = {
      intervalMs: config?.intervalMs ?? 60 * 60 * 1000, // 1 hour default
      staleTTLMs: config?.staleTTLMs ?? 24 * 60 * 60 * 1000, // 24 hours default
      batchSize: config?.batchSize ?? 20,
      maxErrorCount: config?.maxErrorCount ?? 5,
    };
  }

  /**
   * Start the refresh service
   *
   * Begins periodic refresh based on the configured interval.
   * The first refresh runs immediately upon start.
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn("RemoteInstanceRefreshService is already running");
      return;
    }

    this.isRunning = true;
    logger.info(
      {
        intervalMs: this.config.intervalMs,
        staleTTLMs: this.config.staleTTLMs,
        batchSize: this.config.batchSize,
      },
      "Starting RemoteInstanceRefreshService",
    );

    // Run refresh immediately on start
    this.refresh().catch((error) => {
      logger.error({ err: error }, "Initial remote instance refresh failed");
    });

    // Schedule periodic refresh
    this.intervalId = setInterval(() => {
      this.refresh().catch((error) => {
        logger.error({ err: error }, "Scheduled remote instance refresh failed");
      });
    }, this.config.intervalMs);
  }

  /**
   * Stop the refresh service
   *
   * Stops the periodic refresh interval.
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.warn("RemoteInstanceRefreshService is not running");
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info("Stopped RemoteInstanceRefreshService");
  }

  /**
   * Perform a refresh cycle
   *
   * Finds stale instances and refreshes their information from remote servers.
   *
   * @returns Number of instances refreshed
   */
  private async refresh(): Promise<number> {
    try {
      // Calculate cutoff date for stale entries
      const cutoffDate = new Date(Date.now() - this.config.staleTTLMs);

      logger.debug(
        { cutoffDate: cutoffDate.toISOString() },
        "Finding stale remote instances to refresh",
      );

      // Find stale instances that haven't exceeded error limit
      const staleInstances = await this.remoteInstanceRepository.findStale(
        cutoffDate,
        this.config.batchSize,
      );

      if (staleInstances.length === 0) {
        logger.debug("No stale remote instances to refresh");
        return 0;
      }

      logger.info(
        { count: staleInstances.length },
        "Refreshing stale remote instances",
      );

      let refreshedCount = 0;

      // Process instances with limited concurrency
      const concurrency = 5;
      for (let i = 0; i < staleInstances.length; i += concurrency) {
        const batch = staleInstances.slice(i, i + concurrency);
        const results = await Promise.allSettled(
          batch.map((instance) => this.refreshInstance(instance.host)),
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value) {
            refreshedCount++;
          }
        }
      }

      logger.info(
        { refreshedCount, total: staleInstances.length },
        "Remote instance refresh completed",
      );

      return refreshedCount;
    } catch (error) {
      logger.error({ err: error }, "Remote instance refresh failed");
      throw error;
    }
  }

  /**
   * Refresh a single instance's information
   *
   * @param host - The hostname to refresh
   * @returns True if refresh was successful
   */
  private async refreshInstance(host: string): Promise<boolean> {
    try {
      const nodeInfo = await this.fetchNodeInfo(host);

      if (!nodeInfo) {
        // Increment error count
        await this.remoteInstanceRepository.incrementErrorCount(host);
        logger.debug({ host }, "Failed to fetch nodeinfo, incrementing error count");
        return false;
      }

      // Try to fetch icon using software-specific APIs, then fall back to favicon
      const iconUrl = await fetchInstanceIcon(host, nodeInfo.software.name);

      await this.remoteInstanceRepository.upsert({
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

      logger.debug({ host }, "Successfully refreshed remote instance info");
      return true;
    } catch (error) {
      logger.debug({ err: error, host }, "Failed to refresh instance");
      await this.remoteInstanceRepository.incrementErrorCount(host);
      return false;
    }
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
   * Get current configuration
   *
   * @returns Current refresh configuration
   */
  public getConfig(): RemoteInstanceRefreshConfig {
    return { ...this.config };
  }

  /**
   * Check if service is running
   *
   * @returns True if service is currently running
   */
  public isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Manually trigger a refresh cycle
   *
   * Useful for testing or admin-triggered refreshes.
   *
   * @returns Number of instances refreshed
   */
  public async triggerRefresh(): Promise<number> {
    return this.refresh();
  }
}

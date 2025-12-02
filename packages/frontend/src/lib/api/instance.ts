/**
 * Instance API Client
 *
 * Functions for fetching instance information from the backend.
 *
 * @module lib/api/instance
 */

import { apiClient } from "./client";

/**
 * Public remote instance information
 */
export interface PublicRemoteInstance {
  host: string;
  softwareName: string | null;
  softwareVersion: string | null;
  name: string | null;
  description: string | null;
  iconUrl: string | null;
  themeColor: string | null;
}

// In-memory cache for instance info to avoid repeated API calls
const instanceCache = new Map<string, { data: PublicRemoteInstance; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get remote instance information
 *
 * @param host - The hostname of the remote instance (e.g., 'misskey.io')
 * @returns Instance information or null if not found
 */
export async function getRemoteInstanceInfo(host: string): Promise<PublicRemoteInstance | null> {
  // Check cache first
  const cached = instanceCache.get(host);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  try {
    const data = await apiClient.get<PublicRemoteInstance>(`/api/instance/remote/${encodeURIComponent(host)}`);

    // Cache the result
    instanceCache.set(host, {
      data,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return data;
  } catch {
    return null;
  }
}

/**
 * Get remote instance information for multiple hosts
 *
 * @param hosts - Array of hostnames
 * @returns Map of hostname to instance info
 */
export async function getRemoteInstanceInfoBatch(hosts: string[]): Promise<Map<string, PublicRemoteInstance>> {
  const result = new Map<string, PublicRemoteInstance>();
  const hostsToFetch: string[] = [];

  // Check cache first
  for (const host of hosts) {
    const cached = instanceCache.get(host);
    if (cached && cached.expiry > Date.now()) {
      result.set(host, cached.data);
    } else {
      hostsToFetch.push(host);
    }
  }

  // Fetch remaining hosts
  if (hostsToFetch.length > 0) {
    try {
      const data = await apiClient.post<Record<string, PublicRemoteInstance>>("/api/instance/remote/batch", {
        hosts: hostsToFetch,
      });

      // Cache and add to result
      for (const [host, info] of Object.entries(data)) {
        instanceCache.set(host, {
          data: info,
          expiry: Date.now() + CACHE_TTL_MS,
        });
        result.set(host, info);
      }
    } catch {
      // Ignore errors for batch fetch
    }
  }

  return result;
}

/**
 * Clear the instance cache
 */
export function clearInstanceCache(): void {
  instanceCache.clear();
}

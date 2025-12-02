"use client";

/**
 * Hook for fetching and caching instance information
 */

import { useState, useEffect } from "react";
import { apiClient } from "../lib/api/client";
import type { InstanceInfo } from "../lib/types/instance";

/**
 * Cache for instance info to avoid repeated requests
 */
let instanceInfoCache: InstanceInfo | null = null;
let fetchPromise: Promise<InstanceInfo> | null = null;

/**
 * Fetch instance information from API
 */
async function fetchInstanceInfo(): Promise<InstanceInfo> {
  if (instanceInfoCache) {
    return instanceInfoCache;
  }

  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = apiClient.get<InstanceInfo>("/api/instance");

  try {
    instanceInfoCache = await fetchPromise;
    return instanceInfoCache;
  } finally {
    fetchPromise = null;
  }
}

/**
 * Clear instance info cache (call when admin updates settings)
 */
export function clearInstanceInfoCache(): void {
  instanceInfoCache = null;
}

/**
 * Update the favicon dynamically
 */
function updateFavicon(url: string): void {
  if (typeof document === "undefined") return;

  // Remove existing favicon links
  const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
  for (const link of existingLinks) {
    link.remove();
  }

  // Create new favicon link
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Hook to get instance information
 */
export function useInstanceInfo() {
  const [instanceInfo, setInstanceInfo] = useState<InstanceInfo | null>(instanceInfoCache);
  const [isLoading, setIsLoading] = useState(!instanceInfoCache);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (instanceInfoCache) {
      setInstanceInfo(instanceInfoCache);
      setIsLoading(false);
      // Set favicon if available
      if (instanceInfoCache.faviconUrl) {
        updateFavicon(instanceInfoCache.faviconUrl);
      }
      return;
    }

    fetchInstanceInfo()
      .then((info) => {
        setInstanceInfo(info);
        setIsLoading(false);
        // Set favicon if available
        if (info.faviconUrl) {
          updateFavicon(info.faviconUrl);
        }
      })
      .catch((err) => {
        setError(err);
        setIsLoading(false);
      });
  }, []);

  const refetch = async () => {
    clearInstanceInfoCache();
    setIsLoading(true);
    try {
      const info = await fetchInstanceInfo();
      setInstanceInfo(info);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return { instanceInfo, isLoading, error, refetch };
}

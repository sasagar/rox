'use client';

/**
 * Search page component
 *
 * Allows users to search for other users by username or display name.
 * Supports both local and remote (federated) user search.
 */

import { useState, useEffect, useCallback } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useAtom, useAtomValue } from 'jotai';
import { Search, Users, Globe, Home, Loader2, AlertCircle, UserPlus } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Avatar } from '../components/ui/Avatar';
import { MfmRenderer } from '../components/mfm/MfmRenderer';
import { currentUserAtom, tokenAtom } from '../lib/atoms/auth';
import { apiClient } from '../lib/api/client';

/**
 * User type from search results
 */
interface SearchUser {
  id: string;
  username: string;
  host: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followersCount?: number;
  followingCount?: number;
}

/**
 * Search response type
 */
interface SearchResponse {
  users: SearchUser[];
}

/**
 * Resolve response type for remote user lookup
 */
interface ResolveResponse {
  id: string;
  username: string;
  host: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

export default function SearchPage() {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const token = useAtomValue(tokenAtom);
  const [isLoading, setIsLoading] = useState(true);

  // Search state
  const [query, setQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'local'>('all');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Remote user lookup state
  const [isResolvingRemote, setIsResolvingRemote] = useState(false);
  const [resolvedRemoteUser, setResolvedRemoteUser] = useState<SearchUser | null>(null);

  // Restore user session on mount
  useEffect(() => {
    const restoreSession = async () => {
      if (!token) {
        window.location.href = '/login';
        return;
      }

      if (!currentUser) {
        try {
          apiClient.setToken(token);
          const response = await apiClient.get<{ user: any }>('/api/auth/session');
          setCurrentUser(response.user);
          setIsLoading(false);
        } catch (error) {
          console.error('Failed to restore session:', error);
          window.location.href = '/login';
          return;
        }
      } else {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, [token, currentUser, setCurrentUser]);

  /**
   * Check if query looks like a remote user address (user@domain)
   */
  const isRemoteUserQuery = useCallback((q: string): boolean => {
    const trimmed = q.trim();
    // Match patterns like "user@domain.com" or "@user@domain.com"
    return /^@?[a-zA-Z0-9_]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
  }, []);

  /**
   * Perform user search
   */
  const performSearch = useCallback(async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || !token) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setResolvedRemoteUser(null);

    try {
      apiClient.setToken(token);

      // Search local database
      const params = new URLSearchParams({
        q: trimmedQuery,
        limit: '20',
        localOnly: searchScope === 'local' ? 'true' : 'false',
      });

      const response = await apiClient.get<SearchResponse>(`/api/users/search?${params}`);
      setResults(response.users);

      // If query looks like a remote user and we're searching all, try to resolve
      if (searchScope === 'all' && isRemoteUserQuery(trimmedQuery)) {
        setIsResolvingRemote(true);
        try {
          const acct = trimmedQuery.startsWith('@') ? trimmedQuery.slice(1) : trimmedQuery;
          const remoteUser = await apiClient.get<ResolveResponse>(`/api/users/resolve?acct=${encodeURIComponent(acct)}`);

          // Check if this user is already in results
          const alreadyInResults = response.users.some(u => u.id === remoteUser.id);
          if (!alreadyInResults) {
            setResolvedRemoteUser(remoteUser);
          }
        } catch {
          // Remote resolution failed - that's okay, just show local results
        } finally {
          setIsResolvingRemote(false);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      setSearchError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, token, searchScope, isRemoteUserQuery]);

  /**
   * Handle form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  /**
   * Navigate to user profile
   */
  const handleUserClick = (user: SearchUser) => {
    if (user.host) {
      window.location.href = `/@${user.username}@${user.host}`;
    } else {
      window.location.href = `/${user.username}`;
    }
  };

  /**
   * Get user initials for avatar fallback
   */
  const getUserInitials = (user: SearchUser): string => {
    if (user.displayName) {
      return user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user.username.slice(0, 2).toUpperCase();
  };

  /**
   * Format user handle
   */
  const formatHandle = (user: SearchUser): string => {
    if (user.host) {
      return `@${user.username}@${user.host}`;
    }
    return `@${user.username}`;
  };

  // Show loading while checking auth
  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-primary)">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Search className="w-8 h-8 text-(--text-primary)" />
            <h1 className="text-2xl font-bold text-(--text-primary)">
              <Trans>Search</Trans>
            </h1>
          </div>
          <p className="mt-2 text-(--text-secondary)">
            <Trans>Find users by username or display name</Trans>
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text-muted)" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t`Search users... (e.g., alice or alice@mastodon.social)`}
                className="w-full pl-10 pr-4 py-3 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={!query.trim() || isSearching}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trans>Search</Trans>
              )}
            </button>
          </div>

          {/* Search Scope Toggle */}
          <div className="mt-4 flex items-center gap-4">
            <span className="text-sm text-(--text-secondary)">
              <Trans>Search in:</Trans>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSearchScope('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors ${
                  searchScope === 'all'
                    ? 'bg-primary-500 text-white'
                    : 'bg-(--bg-secondary) text-(--text-secondary) hover:bg-(--bg-tertiary)'
                }`}
              >
                <Globe className="w-4 h-4" />
                <Trans>All</Trans>
              </button>
              <button
                type="button"
                onClick={() => setSearchScope('local')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-colors ${
                  searchScope === 'local'
                    ? 'bg-primary-500 text-white'
                    : 'bg-(--bg-secondary) text-(--text-secondary) hover:bg-(--bg-tertiary)'
                }`}
              >
                <Home className="w-4 h-4" />
                <Trans>Local only</Trans>
              </button>
            </div>
          </div>

          {/* Remote user notice */}
          {searchScope === 'all' && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <Trans>
                  Tip: To find users on other servers, enter their full address like @user@example.com
                </Trans>
              </p>
            </div>
          )}
        </form>

        {/* Error Message */}
        {searchError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{searchError}</p>
          </div>
        )}

        {/* Search Results */}
        <div className="bg-(--card-bg) rounded-lg border border-(--border-color) overflow-hidden">
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center py-12 text-(--text-muted)">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">
                <Trans>Search for users</Trans>
              </p>
              <p className="text-sm mt-1">
                <Trans>Enter a username or display name to get started</Trans>
              </p>
            </div>
          ) : isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-(--text-muted)" />
            </div>
          ) : results.length === 0 && !resolvedRemoteUser ? (
            <div className="flex flex-col items-center justify-center py-12 text-(--text-muted)">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">
                <Trans>No users found</Trans>
              </p>
              <p className="text-sm mt-1">
                <Trans>Try a different search term or check the spelling</Trans>
              </p>
              {searchScope === 'local' && (
                <p className="text-sm mt-2 text-blue-600 dark:text-blue-400">
                  <Trans>Try searching "All" to include remote users</Trans>
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-(--border-color)">
              {/* Resolved remote user (if any) */}
              {resolvedRemoteUser && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">
                    <UserPlus className="w-3 h-3" />
                    <Trans>Found on remote server</Trans>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleUserClick(resolvedRemoteUser)}
                    className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <Avatar
                      src={resolvedRemoteUser.avatarUrl}
                      alt={resolvedRemoteUser.displayName || resolvedRemoteUser.username}
                      fallback={getUserInitials(resolvedRemoteUser)}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-(--text-primary) truncate">
                        {resolvedRemoteUser.displayName || resolvedRemoteUser.username}
                      </p>
                      <p className="text-sm text-(--text-muted) truncate">
                        {formatHandle(resolvedRemoteUser)}
                      </p>
                      {resolvedRemoteUser.bio && (
                        <div className="text-sm text-(--text-secondary) mt-1 line-clamp-2">
                          <MfmRenderer text={resolvedRemoteUser.bio} />
                        </div>
                      )}
                    </div>
                    <Globe className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  </button>
                </div>
              )}

              {/* Loading remote user indicator */}
              {isResolvingRemote && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <Trans>Looking up remote user...</Trans>
                  </p>
                </div>
              )}

              {/* Local/cached results */}
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleUserClick(user)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-(--bg-secondary) transition-colors text-left"
                >
                  <Avatar
                    src={user.avatarUrl}
                    alt={user.displayName || user.username}
                    fallback={getUserInitials(user)}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-(--text-primary) truncate">
                      {user.displayName || user.username}
                    </p>
                    <p className="text-sm text-(--text-muted) truncate">
                      {formatHandle(user)}
                    </p>
                    {user.bio && (
                      <div className="text-sm text-(--text-secondary) mt-1 line-clamp-2">
                        <MfmRenderer text={user.bio} />
                      </div>
                    )}
                  </div>
                  {user.host ? (
                    <Globe className="w-4 h-4 text-(--text-muted) shrink-0" />
                  ) : (
                    <Home className="w-4 h-4 text-(--text-muted) shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info about remote user search */}
        {searchScope === 'all' && hasSearched && results.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <Trans>
                Note: Remote users can only be searched by username, not display name,
                unless they have been previously cached on this server.
              </Trans>
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

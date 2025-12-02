/**
 * Remote instance information
 * Represents metadata about a federated server
 */
export interface RemoteInstance {
  /** Domain of the remote instance (e.g., "misskey.io") */
  host: string;
  /** Software name (e.g., "misskey", "mastodon", "gotosocial") */
  softwareName: string | null;
  /** Software version */
  softwareVersion: string | null;
  /** Instance name */
  name: string | null;
  /** Instance description */
  description: string | null;
  /** Instance icon/favicon URL */
  iconUrl: string | null;
  /** Theme color (hex code like "#86b300") */
  themeColor: string | null;
  /** Whether registrations are open */
  openRegistrations: boolean | null;
  /** Number of users */
  usersCount: number | null;
  /** Number of posts/notes */
  notesCount: number | null;
  /** Whether this instance is blocked */
  isBlocked: boolean;
  /** When info was last fetched */
  lastFetchedAt: Date | null;
  /** Number of consecutive fetch errors */
  fetchErrorCount: number;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Public remote instance info for API response
 * Excludes internal fields like fetchErrorCount
 */
export interface PublicRemoteInstance {
  /** Domain of the remote instance */
  host: string;
  /** Software name */
  softwareName: string | null;
  /** Software version */
  softwareVersion: string | null;
  /** Instance name */
  name: string | null;
  /** Instance description */
  description: string | null;
  /** Instance icon/favicon URL */
  iconUrl: string | null;
  /** Theme color */
  themeColor: string | null;
}

"use client";

import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { usersApi, type User } from "../lib/api/users";
import { getProxiedImageUrl } from "../lib/utils/imageProxy";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { UserDisplayName } from "../components/user/UserDisplayName";
import { MfmRenderer } from "../components/mfm/MfmRenderer";
import { Copy, Check, ExternalLink } from "lucide-react";

/**
 * Remote follow interaction page
 *
 * This page allows users from other ActivityPub servers to follow
 * a local user by entering their server address.
 */
export default function InteractPage() {
  const { _ } = useLingui();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverInput, setServerInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Get the acct parameter from URL
  const acct =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("acct") : null;

  // Get the current instance host
  const instanceHost =
    typeof window !== "undefined" ? window.location.host : process.env.URL?.replace(/^https?:\/\//, "") || "localhost";

  // Full WebFinger address
  const webFingerAddress = user ? `@${user.username}@${instanceHost}` : "";

  // Load user data
  useEffect(() => {
    const loadUser = async () => {
      if (!acct) {
        setError(_(t`No account specified`));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const userData = await usersApi.getByUsername(acct);
        setUser(userData);
      } catch (err) {
        console.error("Failed to load user:", err);
        setError(_(t`User not found`));
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [acct, _]);

  // Handle follow redirect
  const handleFollow = () => {
    if (!user || !serverInput.trim()) return;

    setIsRedirecting(true);

    // Clean up server input (remove protocol if present)
    let server = serverInput.trim().toLowerCase();
    server = server.replace(/^https?:\/\//, "");
    server = server.replace(/\/$/, "");

    // Construct the authorize_interaction URL (Mastodon-compatible)
    const interactionUrl = `https://${server}/authorize_interaction?uri=${encodeURIComponent(webFingerAddress)}`;

    // Redirect to the remote server
    window.location.href = interactionUrl;
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!webFingerAddress) return;

    try {
      await navigator.clipboard.writeText(webFingerAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md" padding="lg">
          <CardHeader>
            <CardTitle className="text-center text-xl text-red-600 dark:text-red-400">
              <Trans>User Not Found</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center text-gray-600 dark:text-gray-400">
            <p>{error || <Trans>The requested user could not be found.</Trans>}</p>
            <Button variant="secondary" className="mt-4" onPress={() => (window.location.href = "/")}>
              <Trans>Go to Home</Trans>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build emoji map for MFM rendering
  const profileEmojiMap: Record<string, string> = {};
  if (user.profileEmojis) {
    for (const emoji of user.profileEmojis) {
      profileEmojiMap[emoji.name] = emoji.url;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <Card className="w-full max-w-md" padding="lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            <Trans>Follow @{user.username}</Trans>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* User Info */}
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-3">
              {user.avatarUrl ? (
                <img
                  src={getProxiedImageUrl(user.avatarUrl) || ""}
                  alt={user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-500 dark:text-gray-400">
                  {user.username[0]?.toUpperCase()}
                </div>
              )}
            </div>

            {/* Display Name */}
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              <UserDisplayName
                name={user.displayName}
                username={user.username}
                profileEmojis={user.profileEmojis}
              />
            </h2>

            {/* Handle */}
            <p className="text-gray-600 dark:text-gray-400">{webFingerAddress}</p>

            {/* Bio */}
            {user.bio && (
              <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                <MfmRenderer text={user.bio} customEmojis={profileEmojiMap} />
              </div>
            )}
          </div>

          {/* Server Input */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              <Trans>Enter your server to follow</Trans>
            </label>
            <TextField
              placeholder={_(t`Your server (e.g., mastodon.social)`)}
              value={serverInput}
              onChange={setServerInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && serverInput.trim()) {
                  handleFollow();
                }
              }}
            />
            <Button
              className="w-full"
              onPress={handleFollow}
              isDisabled={!serverInput.trim() || isRedirecting}
            >
              {isRedirecting ? (
                <div className="flex items-center gap-2">
                  <Spinner size="xs" variant="white" />
                  <Trans>Redirecting...</Trans>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  <Trans>Follow</Trans>
                </div>
              )}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">
                <Trans>Or copy the address</Trans>
              </span>
            </div>
          </div>

          {/* Copy Address */}
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-800 dark:text-gray-200 truncate">
              {webFingerAddress}
            </code>
            <Button variant="secondary" onPress={handleCopy} aria-label={_(t`Copy address`)}>
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            <Trans>Paste this address in your app's search to find and follow this account</Trans>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

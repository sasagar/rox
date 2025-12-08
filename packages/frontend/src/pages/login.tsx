"use client";

import React, { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Form } from "react-aria-components";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { tokenAtom, currentUserAtom } from "../lib/atoms/auth";
import { apiClient } from "../lib/api/client";
import { authManager } from "../lib/auth";
import { TextField } from "../components/ui/TextField";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";

/**
 * OAuth provider information from backend
 */
interface OAuthProvider {
  id: string;
  name: string;
}

/**
 * Provider icons (SVG components)
 */
const ProviderIcons: Record<string, React.ReactNode> = {
  github: (
    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  ),
  google: (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  ),
  discord: (
    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  ),
  mastodon: (
    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z" />
    </svg>
  ),
};

/**
 * Login page component
 * Provides authentication with Password, OAuth, and Passkey support
 */
export default function LoginPage() {
  const { _ } = useLingui();
  const [, setToken] = useAtom(tokenAtom);
  const [, setCurrentUser] = useAtom(currentUserAtom);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([]);

  // Check available authentication methods
  const hasPasskey = authManager.isMethodAvailable("passkey");
  const hasOAuth = oauthProviders.length > 0;

  // Check for OAuth error in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError) {
      setError(oauthError);
      // Clean up URL
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  // Fetch available OAuth providers
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch("/api/auth/oauth/providers");
        if (response.ok) {
          const data = await response.json();
          setOauthProviders(data.providers || []);
        }
      } catch {
        // OAuth providers not available, that's fine
      }
    };
    fetchProviders();
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authManager.authenticate("password", {
        username,
        password,
      });

      // Set token and user
      setToken(result.token);
      setCurrentUser(result.user);
      apiClient.setToken(result.token);

      // Wait for state to be saved to localStorage before redirecting
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Redirect to timeline
      window.location.href = "/timeline";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : _(t`Login failed. Please check your credentials.`),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await authManager.authenticate("passkey", username || undefined);

      // Set token and user
      setToken(result.token);
      setCurrentUser(result.user);
      apiClient.setToken(result.token);

      // Wait for state to be saved to localStorage before redirecting
      await new Promise((resolve) => setTimeout(resolve, 100));

      window.location.href = "/timeline";
    } catch (err) {
      setError(err instanceof Error ? err.message : _(t`Passkey authentication failed.`));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthLogin = (provider: string) => {
    // Redirect to OAuth authorization endpoint
    window.location.href = `/api/auth/oauth/${provider}/authorize`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <Card className="w-full max-w-md" padding="lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            <Trans>Sign in to Rox</Trans>
          </CardTitle>
          <CardDescription className="text-center">
            <Trans>Choose your preferred sign-in method</Trans>
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* OAuth Buttons (if available) */}
          {hasOAuth && (
            <div className="mb-4 space-y-2">
              {oauthProviders.map((provider) => (
                <Button
                  key={provider.id}
                  onPress={() => handleOAuthLogin(provider.id)}
                  isDisabled={isSubmitting}
                  className="w-full flex items-center justify-center"
                  variant="secondary"
                >
                  {ProviderIcons[provider.id] || null}
                  <Trans>Sign in with {provider.name}</Trans>
                </Button>
              ))}
            </div>
          )}

          {/* Passkey Login (if available) */}
          {hasPasskey && (
            <div className="mb-4">
              <Button
                onPress={handlePasskeyLogin}
                isDisabled={isSubmitting}
                className="w-full"
                variant="secondary"
              >
                <Trans>Sign in with Passkey</Trans>
              </Button>
            </div>
          )}

          {/* Divider */}
          {(hasPasskey || hasOAuth) && (
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">
                  <Trans>Or continue with password</Trans>
                </span>
              </div>
            </div>
          )}

          {/* Password Login Form */}
          <Form onSubmit={handlePasswordLogin} className="space-y-4">
            <TextField
              label={_(t`Username`)}
              type="text"
              value={username}
              onChange={setUsername}
              errorMessage={error && !username ? _(t`Username is required`) : undefined}
              isRequired
            />

            <TextField
              label={_(t`Password`)}
              type="password"
              value={password}
              onChange={setPassword}
              errorMessage={error && !password ? _(t`Password is required`) : undefined}
              isRequired
            />

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              isDisabled={isSubmitting || !username || !password}
              className="w-full"
            >
              {isSubmitting ? <Trans>Signing in...</Trans> : <Trans>Sign in</Trans>}
            </Button>
          </Form>

          <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            <Trans>Don't have an account?</Trans>{" "}
            <a
              href="/signup"
              className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
            >
              <Trans>Sign up</Trans>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

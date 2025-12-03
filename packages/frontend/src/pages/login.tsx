"use client";

import { useState } from "react";
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

  // Check available authentication methods
  const hasPasskey = authManager.isMethodAvailable("passkey");
  const hasOAuth = authManager.isMethodAvailable("oauth");

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

          {/* OAuth Buttons (if available) */}
          {hasOAuth && (
            <div className="mb-4 space-y-2">
              <Button
                onPress={() => {
                  /* TODO: OAuth flow */
                }}
                isDisabled={isSubmitting}
                className="w-full"
                variant="secondary"
              >
                <Trans>Sign in with GitHub</Trans>
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

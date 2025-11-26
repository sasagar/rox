'use client';

import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { Form } from 'react-aria-components';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLingui } from '@lingui/react';
import { tokenAtom, currentUserAtom } from '../lib/atoms/auth';
import { apiClient } from '../lib/api/client';
import { TextField } from '../components/ui/TextField';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';

interface RegistrationSettings {
  registrationEnabled: boolean;
  inviteOnly: boolean;
  approvalRequired: boolean;
}

/**
 * Signup page component
 * Provides user registration functionality with invitation code support
 */
export default function SignupPage() {
  const { _ } = useLingui();
  const [, setToken] = useAtom(tokenAtom);
  const [, setCurrentUser] = useAtom(currentUserAtom);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<RegistrationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get invitation code from URL if present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code') || urlParams.get('invite');
    if (code) {
      setInvitationCode(code.toUpperCase());
    }
  }, []);

  // Load registration settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await apiClient.get<RegistrationSettings>('/api/auth/register/settings');
        setSettings(data);
      } catch (err) {
        console.error('Failed to load registration settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const data = await apiClient.post<{ user: any; token: string }>('/api/auth/register', {
        username,
        email,
        password,
        name: name || undefined,
        invitationCode: settings?.inviteOnly ? invitationCode : undefined,
      });

      setToken(data.token);
      setCurrentUser(data.user);
      apiClient.setToken(data.token);

      // Redirect to home page
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : _(t`Registration failed. Please try again.`));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)]">
        <Spinner size="lg" />
      </div>
    );
  }

  // Registration disabled
  if (settings && !settings.registrationEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)] px-4 py-8">
        <Card className="w-full max-w-md" padding="lg">
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              <Trans>Registration Closed</Trans>
            </CardTitle>
            <CardDescription className="text-center">
              <Trans>This instance is not accepting new registrations at this time.</Trans>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <a href="/login" className="font-medium text-primary-600 hover:text-primary-500">
                <Trans>Already have an account? Sign in</Trans>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)] px-4 py-8">
      <Card className="w-full max-w-md" padding="lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            <Trans>Create your account</Trans>
          </CardTitle>
          <CardDescription className="text-center">
            <Trans>Join Rox and start sharing</Trans>
          </CardDescription>
          {settings?.inviteOnly && (
            <div className="mt-2 text-center">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                <Trans>Invite Only</Trans>
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <Form onSubmit={handleSignup} className="space-y-4">
            {settings?.inviteOnly && (
              <TextField
                label={_(t`Invitation Code`)}
                type="text"
                value={invitationCode}
                onChange={(val) => setInvitationCode(val.toUpperCase())}
                description={_(t`Enter your invitation code to register`)}
                errorMessage={error && settings.inviteOnly && !invitationCode ? _(t`Invitation code is required`) : undefined}
                isRequired
                className="font-mono"
              />
            )}

            <TextField
              label={_(t`Username`)}
              type="text"
              value={username}
              onChange={setUsername}
              description={_(t`3-20 characters, letters, numbers, and underscores only`)}
              errorMessage={error && !username ? _(t`Username is required`) : undefined}
              isRequired
            />

            <TextField
              label={_(t`Email`)}
              type="email"
              value={email}
              onChange={setEmail}
              errorMessage={error && !email ? _(t`Email is required`) : undefined}
              isRequired
            />

            <TextField
              label={_(t`Password`)}
              type="password"
              value={password}
              onChange={setPassword}
              description={_(t`Minimum 8 characters`)}
              errorMessage={error && !password ? _(t`Password is required`) : undefined}
              isRequired
            />

            <TextField
              label={_(t`Display Name`)}
              type="text"
              value={name}
              onChange={setName}
              description={_(t`Optional`)}
            />

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {settings?.approvalRequired && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-600 dark:text-blue-400">
                <Trans>Your account will need to be approved by an administrator before you can use it.</Trans>
              </div>
            )}

            <Button
              type="submit"
              isDisabled={
                isSubmitting ||
                !username ||
                !email ||
                !password ||
                (settings?.inviteOnly && !invitationCode)
              }
              className="w-full"
            >
              {isSubmitting ? <Trans>Creating account...</Trans> : <Trans>Sign up</Trans>}
            </Button>
          </Form>

          <div className="mt-4 text-center text-sm text-[var(--text-muted)]">
            <Trans>Already have an account?</Trans>{' '}
            <a href="/login" className="font-medium text-primary-600 hover:text-primary-500">
              <Trans>Sign in</Trans>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

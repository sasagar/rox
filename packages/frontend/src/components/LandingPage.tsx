'use client';

import { Trans } from '@lingui/react/macro';
import { Button } from './ui/Button';
import { LanguageSwitcher } from './LanguageSwitcher';
import { DarkModeToggle } from './ui/DarkModeToggle';
import { useInstanceInfo } from '../hooks/useInstanceInfo';
import type { User } from '../lib/types/user';

/**
 * Landing page component - Instance Homepage
 * Shows instance information, features, and context-aware actions
 *
 * @param currentUser - Currently logged in user, or null if not logged in
 */
export function LandingPage({ currentUser }: { currentUser: User | null }) {
  const { instanceInfo, isLoading } = useInstanceInfo();

  // Use instance info or default values
  const instanceName = instanceInfo?.name || 'Rox Instance';
  const instanceDescription = instanceInfo?.description || 'A lightweight ActivityPub server';
  const registrationEnabled = instanceInfo?.registration?.enabled ?? true;
  const inviteOnly = instanceInfo?.registration?.inviteOnly ?? false;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-[var(--card-bg)]">
        <div className="container mx-auto px-4 py-4 max-w-5xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            {instanceInfo?.iconUrl && (
              <img
                src={instanceInfo.iconUrl}
                alt={instanceName}
                className="w-8 h-8 rounded-lg"
              />
            )}
            <span className="font-semibold text-lg text-[var(--text-primary)]">
              {instanceName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <DarkModeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-primary-100 to-[var(--bg-secondary)] dark:from-primary-950 dark:to-[var(--bg-secondary)]">
        {/* Banner Image */}
        {instanceInfo?.bannerUrl && (
          <div className="w-full h-48 md:h-64 overflow-hidden">
            <img
              src={instanceInfo.bannerUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="container mx-auto px-4 py-16 max-w-4xl text-center">
          {/* Instance Icon */}
          {instanceInfo?.iconUrl && !instanceInfo?.bannerUrl && (
            <div className="mb-6">
              <img
                src={instanceInfo.iconUrl}
                alt={instanceName}
                className="w-24 h-24 rounded-2xl mx-auto shadow-lg"
              />
            </div>
          )}

          <h1 className="text-5xl md:text-6xl font-bold text-[var(--text-primary)] mb-4">
            {isLoading ? (
              <span className="animate-pulse bg-[var(--bg-tertiary)] rounded h-16 w-64 inline-block" />
            ) : (
              instanceName
            )}
          </h1>

          <p className="text-xl text-[var(--text-secondary)] mb-8 max-w-2xl mx-auto">
            {isLoading ? (
              <span className="animate-pulse bg-[var(--bg-tertiary)] rounded h-6 w-96 inline-block" />
            ) : (
              instanceDescription
            )}
          </p>

          {/* Registration Status Badge */}
          {!isLoading && (
            <div className="mb-8">
              {registrationEnabled ? (
                inviteOnly ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <Trans>Invite Only</Trans>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <Trans>Open Registration</Trans>
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                  </svg>
                  <Trans>Registration Closed</Trans>
                </span>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center flex-wrap">
            {currentUser ? (
              <Button
                onPress={() => window.location.href = '/timeline'}
                className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
              >
                <Trans>Go to Timeline</Trans>
              </Button>
            ) : (
              <>
                {registrationEnabled && (
                  <Button
                    onPress={() => window.location.href = '/signup'}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
                  >
                    <Trans>Get Started</Trans>
                  </Button>
                )}
                <Button
                  onPress={() => window.location.href = '/login'}
                  className="bg-[var(--card-bg)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] px-8 py-3 rounded-lg font-semibold text-lg shadow hover:shadow-md transition-all"
                >
                  <Trans>Log In</Trans>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <h2 className="text-3xl font-bold text-center text-[var(--text-primary)] mb-12">
          <Trans>Why Join?</Trans>
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 rounded-xl bg-[var(--card-bg)] shadow-sm border border-[var(--border-color)]">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <svg className="w-7 h-7 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">
              <Trans>Federated</Trans>
            </h3>
            <p className="text-[var(--text-secondary)]">
              <Trans>Connect with users across the fediverse using ActivityPub protocol</Trans>
            </p>
          </div>
          <div className="text-center p-6 rounded-xl bg-[var(--card-bg)] shadow-sm border border-[var(--border-color)]">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <svg className="w-7 h-7 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">
              <Trans>Lightweight</Trans>
            </h3>
            <p className="text-[var(--text-secondary)]">
              <Trans>Fast and efficient with minimal resource usage</Trans>
            </p>
          </div>
          <div className="text-center p-6 rounded-xl bg-[var(--card-bg)] shadow-sm border border-[var(--border-color)]">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <svg className="w-7 h-7 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">
              <Trans>Privacy First</Trans>
            </h3>
            <p className="text-[var(--text-secondary)]">
              <Trans>Control your data and choose who sees your posts</Trans>
            </p>
          </div>
        </div>
      </div>

      {/* About Section */}
      <div className="bg-[var(--bg-tertiary)]">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-lg p-8 border border-[var(--border-color)]">
            <h2 className="text-3xl font-bold mb-6 text-[var(--text-primary)]">
              <Trans>About This Instance</Trans>
            </h2>
            <div className="space-y-4 text-[var(--text-secondary)]">
              <p>
                <Trans>
                  This is a Rox instance - a modern, lightweight ActivityPub server that connects you to a decentralized social network.
                </Trans>
              </p>
              <p>
                <Trans>
                  Share your thoughts, connect with friends, and join conversations across the fediverse. Your data stays with you, and you control who sees what you share.
                </Trans>
              </p>
            </div>

            {/* Instance Details */}
            {instanceInfo && (
              <div className="mt-8 pt-8 border-t border-[var(--border-color)]">
                <h3 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">
                  <Trans>Instance Details</Trans>
                </h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {instanceInfo.maintainerEmail && (
                    <div>
                      <dt className="text-[var(--text-muted)] mb-1"><Trans>Contact</Trans></dt>
                      <dd className="text-[var(--text-primary)]">
                        <a href={`mailto:${instanceInfo.maintainerEmail}`} className="text-primary-600 hover:underline">
                          {instanceInfo.maintainerEmail}
                        </a>
                      </dd>
                    </div>
                  )}
                  {instanceInfo.software && (
                    <div>
                      <dt className="text-[var(--text-muted)] mb-1"><Trans>Software</Trans></dt>
                      <dd className="text-[var(--text-primary)]">
                        {instanceInfo.software.name} v{instanceInfo.software.version}
                      </dd>
                    </div>
                  )}
                  {instanceInfo.tosUrl && (
                    <div>
                      <dt className="text-[var(--text-muted)] mb-1"><Trans>Terms of Service</Trans></dt>
                      <dd>
                        <a href={instanceInfo.tosUrl} className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">
                          <Trans>View Terms</Trans>
                        </a>
                      </dd>
                    </div>
                  )}
                  {instanceInfo.privacyPolicyUrl && (
                    <div>
                      <dt className="text-[var(--text-muted)] mb-1"><Trans>Privacy Policy</Trans></dt>
                      <dd>
                        <a href={instanceInfo.privacyPolicyUrl} className="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">
                          <Trans>View Policy</Trans>
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] bg-[var(--card-bg)]">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[var(--text-muted)] text-sm">
              <Trans>Powered by</Trans>{' '}
              <a
                href="https://github.com/Love-rox/rox"
                className="text-primary-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Rox
              </a>
            </p>
            <div className="flex gap-6 text-sm text-[var(--text-muted)]">
              {instanceInfo?.tosUrl && (
                <a href={instanceInfo.tosUrl} className="hover:text-[var(--text-primary)]" target="_blank" rel="noopener noreferrer">
                  <Trans>Terms</Trans>
                </a>
              )}
              {instanceInfo?.privacyPolicyUrl && (
                <a href={instanceInfo.privacyPolicyUrl} className="hover:text-[var(--text-primary)]" target="_blank" rel="noopener noreferrer">
                  <Trans>Privacy</Trans>
                </a>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

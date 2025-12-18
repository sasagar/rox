"use client";

/**
 * About Section Component
 *
 * Displays application information:
 * - Software name and version
 * - Repository link
 * - Instance information
 */

import { Trans } from "@lingui/react/macro";
import { Info, Github, Server, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { useInstanceInfo } from "../../hooks/useInstanceInfo";

/**
 * About section for Settings page
 *
 * Shows version information, repository link, and instance details.
 */
export function AboutSection() {
  const { instanceInfo, isLoading, error } = useInstanceInfo();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          <Trans>About</Trans>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-4">
        {isLoading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <Trans>Loading...</Trans>
          </div>
        ) : error ? (
          <div className="text-sm text-red-500">
            <Trans>Failed to load instance information</Trans>
          </div>
        ) : (
          <>
            {/* Software Info */}
            {instanceInfo?.software && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                    <Server className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {instanceInfo.software.name}
                    </div>
                    <div className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                      v{instanceInfo.software.version}
                    </div>
                  </div>
                </div>

                {instanceInfo.software.repository && (
                  <a
                    href={instanceInfo.software.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    <Trans>View source on GitHub</Trans>
                  </a>
                )}
              </div>
            )}

            {/* Instance Info */}
            {instanceInfo && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <Trans>Instance Information</Trans>
                </h3>

                <dl className="grid grid-cols-1 gap-2 text-sm">
                  {instanceInfo.name && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500 dark:text-gray-400">
                        <Trans>Name</Trans>
                      </dt>
                      <dd className="text-gray-900 dark:text-gray-100 font-medium">
                        {instanceInfo.name}
                      </dd>
                    </div>
                  )}

                  {instanceInfo.url && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500 dark:text-gray-400">
                        <Trans>Domain</Trans>
                      </dt>
                      <dd className="text-gray-900 dark:text-gray-100">
                        {(() => {
                          try {
                            return new URL(instanceInfo.url).hostname;
                          } catch {
                            return instanceInfo.url;
                          }
                        })()}
                      </dd>
                    </div>
                  )}

                  {instanceInfo.registration && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500 dark:text-gray-400">
                        <Trans>Registration</Trans>
                      </dt>
                      <dd className="text-gray-900 dark:text-gray-100">
                        {instanceInfo.registration.enabled ? (
                          instanceInfo.registration.inviteOnly ? (
                            <span className="text-yellow-600 dark:text-yellow-400">
                              <Trans>Invite only</Trans>
                            </span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400">
                              <Trans>Open</Trans>
                            </span>
                          )
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">
                            <Trans>Closed</Trans>
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

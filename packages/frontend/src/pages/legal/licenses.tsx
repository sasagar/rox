"use client";

/**
 * Open Source Licenses Page
 *
 * Displays license information for Rox and its dependencies.
 * Required for AGPL-3.0 compliance.
 */

import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { Layout } from "../../components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { useInstanceInfo } from "../../hooks/useInstanceInfo";
import { ExternalLink, Scale, Code, Package } from "lucide-react";

interface DependencyInfo {
  name: string;
  version: string;
  license: string;
  repository?: string;
}

/**
 * Key dependencies and their licenses
 * This is a curated list of major dependencies
 */
const KEY_DEPENDENCIES: DependencyInfo[] = [
  // Runtime & Framework
  { name: "Bun", version: "1.x", license: "MIT", repository: "https://github.com/oven-sh/bun" },
  { name: "Hono", version: "4.x", license: "MIT", repository: "https://github.com/honojs/hono" },
  { name: "Waku", version: "0.x", license: "MIT", repository: "https://github.com/dai-shi/waku" },
  { name: "React", version: "19.x", license: "MIT", repository: "https://github.com/facebook/react" },

  // Database
  { name: "Drizzle ORM", version: "0.x", license: "Apache-2.0", repository: "https://github.com/drizzle-team/drizzle-orm" },
  { name: "PostgreSQL (pg)", version: "8.x", license: "MIT", repository: "https://github.com/brianc/node-postgres" },

  // UI
  { name: "React Aria Components", version: "1.x", license: "Apache-2.0", repository: "https://github.com/adobe/react-spectrum" },
  { name: "Tailwind CSS", version: "4.x", license: "MIT", repository: "https://github.com/tailwindlabs/tailwindcss" },
  { name: "Lucide React", version: "0.x", license: "ISC", repository: "https://github.com/lucide-icons/lucide" },

  // State Management & i18n
  { name: "Jotai", version: "2.x", license: "MIT", repository: "https://github.com/pmndrs/jotai" },
  { name: "Lingui", version: "5.x", license: "MIT", repository: "https://github.com/lingui/js-lingui" },

  // Utilities
  { name: "Zod", version: "4.x", license: "MIT", repository: "https://github.com/colinhacks/zod" },
  { name: "Sharp", version: "0.x", license: "Apache-2.0", repository: "https://github.com/lovell/sharp" },
  { name: "BullMQ", version: "5.x", license: "MIT", repository: "https://github.com/taskforcesh/bullmq" },

  // Development
  { name: "TypeScript", version: "5.x", license: "Apache-2.0", repository: "https://github.com/microsoft/TypeScript" },
  { name: "oxlint", version: "0.x", license: "MIT", repository: "https://github.com/oxc-project/oxc" },
];

export default function LicensesPage() {
  const { instanceInfo, isLoading } = useInstanceInfo();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (isLoading || !mounted) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  const sourceCodeUrl = instanceInfo?.sourceCodeUrl || "https://github.com/Love-Rox/rox";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-(--text-primary) flex items-center gap-3">
            <Scale className="w-8 h-8" />
            <Trans>Open Source Licenses</Trans>
          </h1>
          <p className="mt-2 text-(--text-secondary)">
            <Trans>Rox is open source software licensed under the AGPL-3.0 license.</Trans>
          </p>
        </div>

        {/* Rox License */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              <Trans>Rox License</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-(--bg-secondary) rounded-lg">
              <p className="font-mono text-sm text-(--text-primary)">
                GNU Affero General Public License v3.0 (AGPL-3.0)
              </p>
            </div>

            <p className="text-sm text-(--text-secondary)">
              <Trans>
                This software is licensed under the GNU Affero General Public License version 3.0.
                This means you are free to use, modify, and distribute this software, but any modifications
                must also be released under the same license, and if you run a modified version as a
                network service, you must make the source code available to users.
              </Trans>
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href={sourceCodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                <Code className="w-4 h-4" />
                <Trans>View Source Code</Trans>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://www.gnu.org/licenses/agpl-3.0.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-(--text-primary) bg-(--bg-secondary) hover:bg-(--bg-tertiary) rounded-lg transition-colors"
              >
                <Scale className="w-4 h-4" />
                <Trans>Read Full License</Trans>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Dependencies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              <Trans>Third-Party Dependencies</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-(--text-secondary) mb-4">
              <Trans>
                Rox is built upon many excellent open source projects. Below are the key dependencies
                and their respective licenses.
              </Trans>
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-(--border-color)">
                    <th className="text-left py-3 px-2 font-medium text-(--text-primary)">
                      <Trans>Package</Trans>
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-(--text-primary)">
                      <Trans>Version</Trans>
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-(--text-primary)">
                      <Trans>License</Trans>
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-(--text-primary)">
                      <Trans>Repository</Trans>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {KEY_DEPENDENCIES.map((dep) => (
                    <tr key={dep.name} className="border-b border-(--border-color) last:border-0">
                      <td className="py-3 px-2 font-medium text-(--text-primary)">
                        {dep.name}
                      </td>
                      <td className="py-3 px-2 text-(--text-secondary)">
                        {dep.version}
                      </td>
                      <td className="py-3 px-2">
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                          {dep.license}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        {dep.repository && (
                          <a
                            href={dep.repository}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                          >
                            <span className="truncate max-w-[200px]">
                              {dep.repository.replace("https://github.com/", "")}
                            </span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-(--text-muted)">
              <Trans>
                This list shows major dependencies. For a complete list, see the package.json files
                in the source code repository.
              </Trans>
            </p>
          </CardContent>
        </Card>

        {/* Footer note */}
        <div className="mt-6 text-center text-sm text-(--text-muted)">
          <p>
            <Trans>
              Thank you to all the open source maintainers who make projects like this possible.
            </Trans>
          </p>
        </div>
      </div>
    </Layout>
  );
}

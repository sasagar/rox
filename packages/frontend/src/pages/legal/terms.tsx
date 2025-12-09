"use client";

/**
 * Terms of Service Page
 *
 * Displays the Terms of Service for the instance.
 * If an external TOS URL is configured, shows a link to it.
 * Otherwise, displays the default template.
 */

import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { Layout } from "../../components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { useInstanceInfo } from "../../hooks/useInstanceInfo";
import { ExternalLink, FileText } from "lucide-react";
import { SpaLink } from "../../components/ui/SpaLink";

export default function TermsOfServicePage() {
  const { instanceInfo, isLoading, error } = useInstanceInfo();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for external TOS URL and redirect if present
  useEffect(() => {
    if (mounted && instanceInfo?.tosUrl) {
      // Show external link instead of redirecting (better UX)
    }
  }, [mounted, instanceInfo?.tosUrl]);

  if (isLoading || !mounted) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="py-10 text-center text-(--text-muted)">
          <Trans>Failed to load instance information</Trans>
        </div>
      </Layout>
    );
  }

  const instanceName = instanceInfo?.name || "This instance";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-(--text-primary) flex items-center gap-3">
            <FileText className="w-8 h-8" />
            <Trans>Terms of Service</Trans>
          </h1>
          {instanceInfo?.name && (
            <p className="mt-2 text-(--text-secondary)">{instanceInfo.name}</p>
          )}
        </div>

        {/* External TOS link if configured */}
        {instanceInfo?.tosUrl && (
          <Card className="mb-6 border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <ExternalLink className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <div>
                  <p className="text-sm text-(--text-primary)">
                    <Trans>
                      This instance has a dedicated Terms of Service page:
                    </Trans>
                  </p>
                  <a
                    href={instanceInfo.tosUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    {instanceInfo.tosUrl}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Default Terms of Service template */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Terms of Service Agreement</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>1. Acceptance of Terms</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  By accessing or using {instanceName}, you agree to be bound by these Terms of
                  Service. If you do not agree to these terms, please do not use this service.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>2. User Accounts</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  You are responsible for maintaining the confidentiality of your account credentials
                  and for all activities that occur under your account. You must be at least 13 years
                  old to use this service. You agree to provide accurate information when creating
                  your account.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>3. Acceptable Use</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed mb-3">
                <Trans>You agree not to use this service to:</Trans>
              </p>
              <ul className="list-disc list-inside text-(--text-secondary) space-y-1">
                <li><Trans>Post illegal content or engage in illegal activities</Trans></li>
                <li><Trans>Harass, abuse, or threaten other users</Trans></li>
                <li><Trans>Impersonate others or spread misinformation</Trans></li>
                <li><Trans>Distribute spam, malware, or phishing content</Trans></li>
                <li><Trans>Violate intellectual property rights</Trans></li>
                <li><Trans>Attempt to gain unauthorized access to systems</Trans></li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>4. Content Ownership</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  You retain ownership of content you create and post. By posting content, you grant
                  this instance a license to store, display, and distribute your content as part of
                  the service's normal operation, including federation with other ActivityPub servers.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>5. Moderation</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  Instance administrators and moderators reserve the right to remove content, suspend
                  accounts, or take other actions to maintain a safe community. Moderation decisions
                  are made at the discretion of the moderation team.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>6. Federation</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  This instance participates in the ActivityPub federation network. Your public
                  content may be visible to users on other federated instances. Once content is
                  federated, we cannot guarantee its complete removal from all servers.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>7. Service Availability</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  We strive to maintain service availability but do not guarantee uninterrupted
                  access. The service may be modified, suspended, or discontinued at any time without
                  notice.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>8. Limitation of Liability</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  This service is provided "as is" without warranties of any kind. We are not liable
                  for any damages arising from your use of the service, including but not limited to
                  data loss, service interruptions, or user-generated content.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>9. Changes to Terms</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  We may update these terms at any time. Continued use of the service after changes
                  constitutes acceptance of the new terms. Major changes will be communicated to
                  users when possible.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>10. Contact</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  For questions about these terms, please{" "}
                  <SpaLink
                    to="/contact"
                    className="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    contact us through our inquiry form
                  </SpaLink>.
                </Trans>
              </p>
            </section>

            <div className="pt-4 border-t border-(--border-color)">
              <p className="text-sm text-(--text-muted)">
                <Trans>Last updated: {new Date().toLocaleDateString()}</Trans>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

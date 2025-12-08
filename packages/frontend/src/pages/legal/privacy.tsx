"use client";

/**
 * Privacy Policy Page
 *
 * Displays the Privacy Policy for the instance.
 * If an external Privacy Policy URL is configured, shows a link to it.
 * Otherwise, displays the default template.
 */

import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { Layout } from "../../components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { useInstanceInfo } from "../../hooks/useInstanceInfo";
import { ExternalLink, Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
  const { instanceInfo, isLoading, error } = useInstanceInfo();
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
            <Shield className="w-8 h-8" />
            <Trans>Privacy Policy</Trans>
          </h1>
          {instanceInfo?.name && (
            <p className="mt-2 text-(--text-secondary)">{instanceInfo.name}</p>
          )}
        </div>

        {/* External Privacy Policy link if configured */}
        {instanceInfo?.privacyPolicyUrl && (
          <Card className="mb-6 border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <ExternalLink className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <div>
                  <p className="text-sm text-(--text-primary)">
                    <Trans>
                      This instance has a dedicated Privacy Policy page:
                    </Trans>
                  </p>
                  <a
                    href={instanceInfo.privacyPolicyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    {instanceInfo.privacyPolicyUrl}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Default Privacy Policy template */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Privacy Policy</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>1. Information We Collect</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed mb-3">
                <Trans>
                  When you use {instanceName}, we collect the following types of information:
                </Trans>
              </p>
              <ul className="list-disc list-inside text-(--text-secondary) space-y-1">
                <li>
                  <Trans>
                    <strong>Account information:</strong> Username, email address, and password
                    (securely hashed)
                  </Trans>
                </li>
                <li>
                  <Trans>
                    <strong>Profile information:</strong> Display name, bio, avatar, and any other
                    information you choose to provide
                  </Trans>
                </li>
                <li>
                  <Trans>
                    <strong>Content:</strong> Posts, media uploads, and interactions (likes, shares,
                    follows)
                  </Trans>
                </li>
                <li>
                  <Trans>
                    <strong>Technical data:</strong> IP address, browser type, and access logs for
                    security purposes
                  </Trans>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>2. How We Use Your Information</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed mb-3">
                <Trans>We use collected information to:</Trans>
              </p>
              <ul className="list-disc list-inside text-(--text-secondary) space-y-1">
                <li><Trans>Provide and maintain the service</Trans></li>
                <li><Trans>Process your account registration and authentication</Trans></li>
                <li><Trans>Display your content to other users</Trans></li>
                <li><Trans>Send service-related notifications</Trans></li>
                <li><Trans>Ensure security and prevent abuse</Trans></li>
                <li><Trans>Comply with legal obligations</Trans></li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>3. Federation and Data Sharing</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  This instance participates in the ActivityPub federation network. When you make
                  content public, it may be shared with other federated servers. This includes:
                </Trans>
              </p>
              <ul className="list-disc list-inside text-(--text-secondary) space-y-1 mt-3">
                <li><Trans>Your public profile information</Trans></li>
                <li><Trans>Public posts and media</Trans></li>
                <li><Trans>Public follow/follower relationships</Trans></li>
              </ul>
              <p className="text-(--text-secondary) leading-relaxed mt-3">
                <Trans>
                  Once data is federated, other servers have their own copies and we cannot
                  guarantee its removal from all locations.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>4. Data Retention</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  We retain your data for as long as your account is active. When you delete your
                  account, we will remove your data from our servers, though federated copies on
                  other servers may persist. Access logs are typically retained for security
                  purposes for a limited period.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>5. Your Rights</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed mb-3">
                <Trans>You have the right to:</Trans>
              </p>
              <ul className="list-disc list-inside text-(--text-secondary) space-y-1">
                <li><Trans>Access your personal data</Trans></li>
                <li><Trans>Correct inaccurate data</Trans></li>
                <li><Trans>Delete your account and associated data</Trans></li>
                <li><Trans>Export your data in a portable format</Trans></li>
                <li><Trans>Object to certain data processing</Trans></li>
              </ul>
              <p className="text-(--text-secondary) leading-relaxed mt-3">
                <Trans>
                  To exercise these rights, contact the instance administrator or use the settings
                  in your account.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>6. Cookies and Local Storage</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  We use essential cookies and local storage to maintain your session and store
                  preferences. These are necessary for the service to function and cannot be
                  disabled without affecting functionality.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>7. Security</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  We implement appropriate security measures to protect your data, including
                  encrypted connections (HTTPS), secure password hashing, and access controls.
                  However, no system is completely secure, and we cannot guarantee absolute
                  security.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>8. Third-Party Services</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  We may use third-party services for hosting, email delivery, or other
                  infrastructure needs. These services have their own privacy policies. We do not
                  sell your personal data to third parties.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>9. Children's Privacy</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  This service is not intended for children under 13 years of age. We do not
                  knowingly collect personal information from children. If you believe a child has
                  provided us with personal data, please contact us.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>10. Changes to This Policy</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  We may update this privacy policy from time to time. We will notify users of
                  significant changes when possible. Your continued use of the service after
                  changes constitutes acceptance of the updated policy.
                </Trans>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-3">
                <Trans>11. Contact</Trans>
              </h2>
              <p className="text-(--text-secondary) leading-relaxed">
                <Trans>
                  For privacy-related questions or to exercise your rights, please contact the
                  instance administrator
                  {instanceInfo?.maintainerEmail && (
                    <>
                      {" "}at{" "}
                      <a
                        href={`mailto:${instanceInfo.maintainerEmail}`}
                        className="text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {instanceInfo.maintainerEmail}
                      </a>
                    </>
                  )}.
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

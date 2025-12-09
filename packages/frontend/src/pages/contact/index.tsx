"use client";

/**
 * Contact Page
 *
 * Allows users to submit inquiries and view their contact thread history.
 * For logged-in users, shows their existing threads.
 * Anyone can submit a new inquiry.
 */

import { useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Layout } from "../../components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { SpaLink } from "../../components/ui/SpaLink";
import { useAtomValue } from "jotai";
import { currentUserAtom } from "../../lib/atoms/auth";
import {
  createContactThread,
  listContactThreads,
  getContactCategories,
} from "../../lib/api/contact";
import type { ContactThreadSummary, ContactCategoryOption } from "shared";
import {
  MessageCircle,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

const statusIcons: Record<string, React.ReactNode> = {
  open: <Clock className="w-4 h-4 text-blue-500" />,
  in_progress: <AlertCircle className="w-4 h-4 text-yellow-500" />,
  resolved: <CheckCircle className="w-4 h-4 text-green-500" />,
  closed: <XCircle className="w-4 h-4 text-gray-500" />,
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export default function ContactPage() {
  const { t } = useLingui();
  const currentUser = useAtomValue(currentUserAtom);
  const [mounted, setMounted] = useState(false);
  const [threads, setThreads] = useState<ContactThreadSummary[]>([]);
  const [categories, setCategories] = useState<ContactCategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);

  // Form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadData();
  }, [currentUser]);

  async function loadData() {
    setIsLoading(true);
    try {
      // Load categories
      const categoriesRes = await getContactCategories();
      setCategories(categoriesRes.categories);

      // Load threads if logged in
      if (currentUser) {
        const threadsRes = await listContactThreads();
        setThreads(threadsRes.threads);
      }
    } catch (err) {
      console.error("Failed to load contact data:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await createContactThread({
        subject,
        category: category as any,
        message,
        email: currentUser ? undefined : email,
      });

      setSuccess(true);
      setShowNewForm(false);
      setSubject("");
      setCategory("general");
      setMessage("");
      setEmail("");

      // Reload threads if logged in
      if (currentUser) {
        const threadsRes = await listContactThreads();
        setThreads(threadsRes.threads);
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit inquiry");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mounted) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-(--text-primary) flex items-center gap-3">
              <MessageCircle className="w-8 h-8" />
              <Trans>Contact Us</Trans>
            </h1>
            <p className="mt-2 text-(--text-secondary)">
              <Trans>Have a question or need help? We're here to assist you.</Trans>
            </p>
          </div>
          {!showNewForm && (
            <Button onClick={() => setShowNewForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              <Trans>New Inquiry</Trans>
            </Button>
          )}
        </div>

        {/* Success message */}
        {success && (
          <Card className="mb-6 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm text-(--text-primary) font-medium">
                    <Trans>Your inquiry has been submitted successfully!</Trans>
                  </p>
                  <p className="text-sm text-(--text-secondary)">
                    <Trans>We will respond as soon as possible.</Trans>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* New inquiry form */}
        {showNewForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>
                <Trans>New Inquiry</Trans>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                {!currentUser && (
                  <div>
                    <label className="block text-sm font-medium text-(--text-primary) mb-1">
                      <Trans>Email</Trans> *
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder={t`your@email.com`}
                    />
                    <p className="text-xs text-(--text-muted) mt-1">
                      <Trans>We'll use this to respond to your inquiry</Trans>
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-(--text-primary) mb-1">
                    <Trans>Category</Trans>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-(--text-primary) mb-1">
                    <Trans>Subject</Trans> *
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    maxLength={200}
                    className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder={t`Brief description of your inquiry`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-(--text-primary) mb-1">
                    <Trans>Message</Trans> *
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    maxLength={10000}
                    rows={6}
                    className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-y"
                    placeholder={t`Please describe your inquiry in detail...`}
                  />
                  <p className="text-xs text-(--text-muted) mt-1">
                    {message.length}/10000
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onPress={() => setShowNewForm(false)}
                    isDisabled={isSubmitting}
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button type="submit" isDisabled={isSubmitting}>
                    {isSubmitting ? <Spinner size="sm" /> : <Trans>Submit</Trans>}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Existing threads (logged-in users only) */}
        {currentUser && (
          <Card>
            <CardHeader>
              <CardTitle>
                <Trans>Your Inquiries</Trans>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : threads.length === 0 ? (
                <div className="text-center py-8 text-(--text-muted)">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>
                    <Trans>You haven't submitted any inquiries yet.</Trans>
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-(--border-color)">
                  {threads.map((thread) => (
                    <SpaLink
                      key={thread.id}
                      to={`/contact/${thread.id}`}
                      className="block py-4 hover:bg-(--bg-secondary) -mx-4 px-4 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {statusIcons[thread.status]}
                            <span className="text-xs text-(--text-muted) uppercase">
                              {statusLabels[thread.status]}
                            </span>
                            {thread.unreadCount > 0 && (
                              <span className="px-2 py-0.5 text-xs bg-primary-500 text-white rounded-full">
                                {thread.unreadCount} new
                              </span>
                            )}
                          </div>
                          <h3 className="font-medium text-(--text-primary) truncate">
                            {thread.subject}
                          </h3>
                          {thread.lastMessagePreview && (
                            <p className="text-sm text-(--text-muted) truncate mt-1">
                              {thread.lastMessagePreview}
                            </p>
                          )}
                          <p className="text-xs text-(--text-muted) mt-2">
                            {new Date(thread.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-(--text-muted) shrink-0 ml-2" />
                      </div>
                    </SpaLink>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Guest info */}
        {!currentUser && !showNewForm && (
          <Card>
            <CardContent className="p-6 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-(--text-muted)" />
              <p className="text-(--text-secondary) mb-4">
                <Trans>
                  You can submit an inquiry without an account.
                  To track your inquiry history, please log in.
                </Trans>
              </p>
              <Button onClick={() => setShowNewForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                <Trans>Submit an Inquiry</Trans>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

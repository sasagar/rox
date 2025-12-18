"use client";

/**
 * Contact Page
 *
 * Provides a contact form for users to reach the instance administrators.
 * Required for GDPR compliance to allow users to exercise their data rights.
 *
 * @module pages/contact
 */

import { useState } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useAtom } from "jotai";
import { Mail, Send, User, MessageSquare, AlertCircle } from "lucide-react";
import { Layout } from "../components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { useInstanceInfo } from "../hooks/useInstanceInfo";
import { currentUserAtom, tokenAtom } from "../lib/atoms/auth";
import { addToastAtom } from "../lib/atoms/toast";
import { apiClient } from "../lib/api/client";
import type { ContactCategory, ContactCategoryOption } from "shared";

const CATEGORIES: ContactCategoryOption[] = [
  { value: "general", label: "General Inquiry" },
  { value: "gdpr", label: "Privacy / GDPR Request" },
  { value: "report", label: "Report an Issue" },
  { value: "technical", label: "Technical Support" },
  { value: "other", label: "Other" },
];

export default function ContactPage() {
  const { instanceInfo, isLoading: isLoadingInstance } = useInstanceInfo();
  const [currentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [category, setCategory] = useState<ContactCategory>("general");
  const [name, setName] = useState(currentUser?.displayName || currentUser?.username || "");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      addToast({
        type: "error",
        message: t`Please enter a message`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (token) {
        apiClient.setToken(token);
      }

      await apiClient.post("/api/contact", {
        category,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        subject: subject.trim() || undefined,
        message: message.trim(),
      });

      setIsSubmitted(true);
      addToast({
        type: "success",
        message: t`Your message has been sent`,
      });
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to send message`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInstance) {
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
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-(--text-primary) flex items-center gap-3">
            <Mail className="w-8 h-8" />
            <Trans>Contact Us</Trans>
          </h1>
          {instanceInfo?.name && (
            <p className="mt-2 text-(--text-secondary)">{instanceInfo.name}</p>
          )}
        </div>

        {/* Direct email if configured */}
        {instanceInfo?.maintainerEmail && (
          <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-(--text-primary) mb-1">
                    <Trans>You can also reach us directly at:</Trans>
                  </p>
                  <a
                    href={`mailto:${instanceInfo.maintainerEmail}`}
                    className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    {instanceInfo.maintainerEmail}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isSubmitted ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Send className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-(--text-primary) mb-2">
                <Trans>Message Sent</Trans>
              </h2>
              <p className="text-(--text-secondary) mb-4">
                <Trans>
                  Thank you for contacting us. We'll get back to you as soon as possible.
                </Trans>
              </p>
              <Button onPress={() => setIsSubmitted(false)}>
                <Trans>Send Another Message</Trans>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                <Trans>Send a Message</Trans>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category */}
                <div>
                  <label
                    htmlFor="category"
                    className="block text-sm font-medium text-(--text-primary) mb-2"
                  >
                    <Trans>Category</Trans>
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ContactCategory)}
                    className="w-full rounded-md border border-(--border-color) px-3 py-2 bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={isSubmitting}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* GDPR info box */}
                {category === "gdpr" && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-700 dark:text-yellow-300">
                        <p className="font-medium mb-1">
                          <Trans>GDPR Data Requests</Trans>
                        </p>
                        <p>
                          <Trans>
                            For data access, correction, or deletion requests, please include your
                            username and specify what data you're requesting. You can also export
                            your data directly from Settings → Account → Data Export.
                          </Trans>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Name (optional for non-logged-in users) */}
                {!currentUser && (
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-(--text-primary) mb-2"
                    >
                      <Trans>Name</Trans>
                      <span className="text-(--text-muted) font-normal ml-1">
                        (<Trans>optional</Trans>)
                      </span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t`Your name`}
                        className="w-full rounded-md border border-(--border-color) pl-10 pr-3 py-2 bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                )}

                {/* Email (optional for non-logged-in users) */}
                {!currentUser && (
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-(--text-primary) mb-2"
                    >
                      <Trans>Email</Trans>
                      <span className="text-(--text-muted) font-normal ml-1">
                        (<Trans>optional, for reply</Trans>)
                      </span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t`your@email.com`}
                        className="w-full rounded-md border border-(--border-color) pl-10 pr-3 py-2 bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium text-(--text-primary) mb-2"
                  >
                    <Trans>Subject</Trans>
                    <span className="text-(--text-muted) font-normal ml-1">
                      (<Trans>optional</Trans>)
                    </span>
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t`Brief description of your inquiry`}
                    maxLength={200}
                    className="w-full rounded-md border border-(--border-color) px-3 py-2 bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-(--text-primary) mb-2"
                  >
                    <Trans>Message</Trans>
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t`Please describe your inquiry in detail...`}
                    required
                    rows={6}
                    maxLength={5000}
                    className="w-full rounded-md border border-(--border-color) px-3 py-2 bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    disabled={isSubmitting}
                  />
                  <div className="mt-1 text-right text-xs text-(--text-muted)">
                    {message.length}/5000
                  </div>
                </div>

                {/* Logged in user info */}
                {currentUser && (
                  <div className="p-3 bg-(--bg-secondary) rounded-md text-sm text-(--text-secondary)">
                    <Trans>
                      Sending as <strong>@{currentUser.username}</strong>. We'll respond to your
                      account's registered email if needed.
                    </Trans>
                  </div>
                )}

                {/* Submit button */}
                <Button type="submit" isDisabled={isSubmitting || !message.trim()}>
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <Spinner size="xs" variant="white" />
                      <span>
                        <Trans>Sending...</Trans>
                      </span>
                    </div>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      <Trans>Send Message</Trans>
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

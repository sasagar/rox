import type { PageProps } from "waku/router";
import { ContactThreadPageClient } from "../../components/pages/ContactThreadPageClient";

/**
 * Contact Thread Detail Page (Server Component)
 *
 * Renders the client component with dynamic routing configuration.
 * This page displays a contact thread in a chat-style interface.
 */
export default function ContactThreadPage({ threadId }: PageProps<"/contact/[threadId]">) {
  if (!threadId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Thread not found</h1>
        </div>
      </div>
    );
  }

  return <ContactThreadPageClient threadId={threadId} />;
}

/**
 * Waku configuration for contact thread page
 * Marks this page as dynamically rendered at request time
 *
 * @returns Configuration object with render mode
 */
export const getConfig = async () => {
  return {
    render: "dynamic",
  } as const;
};

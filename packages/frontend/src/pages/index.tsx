'use client';

import { Button } from '../components/ui/Button.js';
import { TextField } from '../components/ui/TextField.js';

/**
 * Home page component.
 * Displays a welcome message and demonstrates UI components.
 *
 * @returns Homepage with UI component demonstrations
 */
export default function HomePage() {
  // Translation helper - returns default message during SSR
  const t = (id: string, message: string) => {
    if (typeof window === 'undefined') return message;
    return message; // For now, just return the message directly
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">
          {t('FleU7c', 'Welcome to Rox')}
        </h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <p className="text-gray-600">
            {t(
              'JhCP7F',
              'A lightweight ActivityPub server with Misskey API compatibility'
            )}
          </p>

          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">
              {t('1DEHAf', 'UI Components Demo')}
            </h2>

            <div>
              <h3 className="text-lg font-medium mb-2">Buttons:</h3>
              <div className="flex gap-2 flex-wrap">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Text Fields:</h3>
              <div className="space-y-3">
                <TextField label="Username" description="Enter your username" />
                <TextField label="Password" type="password" />
                <TextField label="Bio" multiline rows={3} />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-500">
              {t(
                'm990Se',
                'Phase 2: Frontend (Waku + React Aria Components + Lingui) - Setup Complete!'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Note: getConfig cannot be used with 'use client' directive
// This page will be rendered on the client side

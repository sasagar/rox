# Phase 2: Frontend (Waku Client)

**期間:** 3-4週間
**ステータス:** 🚧 進行中
**前提条件:** Phase 1 (Misskey API)完了 ✅
**並行可能:** Phase 3と並行可能

## 目的

Waku + React Server Components + Jotai を活用した、高速で使いやすいWebクライアントを構築する。

## 技術スタック

| カテゴリ | 技術 | 目的 |
|---------|------|------|
| フレームワーク | Waku | React Server Components (RSC) ネイティブサポート |
| 状態管理 | Jotai | アトミックな状態管理、最小限の再レンダリング |
| UIコンポーネント | React Aria Components | アクセシブルで高品質なヘッドレスUIコンポーネント |
| スタイリング | Tailwind CSS | ユーティリティファーストCSS、ビルド時最適化 |
| 国際化 | Lingui | 読みやすく自動化された最適化されたi18n（3kb） |
| フォーム | React Hook Form | パフォーマンス重視のフォーム管理 |

## 実装順序

1. **Waku + Jotai環境構築** (Week 1)
2. **多言語化設定 (Lingui)** (Week 1)
3. **UIコンポーネントライブラリ (React Aria Components + Tailwind)** (Week 1-2)
4. **認証フロー** (Week 2)
5. **タイムライン実装** (Week 2-3)
6. **投稿機能** (Week 3)
7. **ユーザーインタラクション** (Week 3-4)
8. **パフォーマンス最適化** (Week 4)

---

## 1. Waku + Jotai環境構築（Week 1）

**優先度:** 🔴 最高（全フロントエンド開発の前提）

### 1.1 プロジェクト初期化

```bash
cd packages/frontend
bun add waku react react-dom
bun add -D @types/react @types/react-dom
```

### 1.2 ディレクトリ構造

```
packages/frontend/src/
├── app/                    # Waku App Routes
│   ├── layout.tsx         # Root Layout
│   ├── page.tsx           # Home (Timeline)
│   ├── login/
│   │   └── page.tsx       # Login Page
│   ├── signup/
│   │   └── page.tsx       # Signup Page
│   ├── notes/
│   │   └── [id]/
│   │       └── page.tsx   # Note Detail
│   └── users/
│       └── [username]/
│           └── page.tsx   # User Profile
├── components/
│   ├── ui/                # Base UI Components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   └── ...
│   ├── note/              # Note Components
│   │   ├── NoteCard.tsx
│   │   ├── NoteComposer.tsx
│   │   └── ...
│   ├── timeline/          # Timeline Components
│   │   ├── Timeline.tsx
│   │   └── ...
│   └── user/              # User Components
│       ├── UserCard.tsx
│       └── ...
├── lib/
│   ├── api/               # API Client
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── notes.ts
│   │   └── ...
│   ├── atoms/             # Jotai Atoms
│   │   ├── auth.ts
│   │   ├── timeline.ts
│   │   └── ...
│   └── utils/             # Utility Functions
│       ├── format.ts
│       └── ...
└── styles/
    └── globals.css        # Global Styles
```

### 1.3 Tailwind CSS設定

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6',
          dark: '#2563eb',
        },
        // ... カスタムカラー
      },
    },
  },
  plugins: [],
};
```

### 1.4 APIクライアント

```typescript
// src/lib/api/client.ts
export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ... その他のメソッド
}

export const apiClient = new ApiClient(
  process.env.API_URL || 'http://localhost:3000'
);
```

**完了条件:**
- [ ] Waku開発サーバー起動
- [ ] Tailwind CSS動作確認
- [ ] APIクライアント実装
- [ ] 基本的なルーティング設定

---

## 2. 多言語化設定（Lingui）（Week 1）

**優先度:** 🔴 最高（全UI実装の前提）
**ライブラリ:** [@lingui/core](https://lingui.dev/) - 3kb、最適化されたi18nライブラリ

### 2.1 Linguiセットアップ

```bash
# Lingui関連パッケージのインストール
bun add @lingui/core @lingui/react
bun add -D @lingui/cli @lingui/macro babel-plugin-macros
```

### 2.2 Lingui設定ファイル

```javascript
// lingui.config.js
/** @type {import('@lingui/conf').LinguiConfig} */
export default {
  locales: ['en', 'ja'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
    },
  ],
  format: 'po',
};
```

### 2.3 i18nプロバイダー設定

```typescript
// src/lib/i18n.ts
import { i18n } from '@lingui/core';
import { messages as enMessages } from '@/locales/en/messages';
import { messages as jaMessages } from '@/locales/ja/messages';

export const locales = {
  en: 'English',
  ja: '日本語',
};

export const defaultLocale = 'en';

i18n.load({
  en: enMessages,
  ja: jaMessages,
});

i18n.activate(defaultLocale);

export { i18n };
```

```typescript
// src/app/layout.tsx
import { I18nProvider } from '@lingui/react';
import { i18n } from '@/lib/i18n';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={i18n.locale}>
      <body>
        <I18nProvider i18n={i18n}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
```

### 2.4 使用例

```typescript
// Trans コンポーネント使用例
import { Trans } from '@lingui/macro';

export function WelcomeMessage() {
  return (
    <h1>
      <Trans>Welcome to Rox</Trans>
    </h1>
  );
}

// t マクロ使用例（プレーンテキスト）
import { t } from '@lingui/macro';

const placeholder = t`Enter your username`;

// 複数形対応
import { plural } from '@lingui/macro';

const message = plural(count, {
  one: '# note',
  other: '# notes',
});
```

### 2.5 言語切り替え機能

```typescript
// src/components/LanguageSwitcher.tsx
'use client';

import { useLingui } from '@lingui/react';
import { locales } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { i18n } = useLingui();

  return (
    <select
      value={i18n.locale}
      onChange={(e) => {
        i18n.activate(e.target.value);
        // Save to localStorage for persistence
        localStorage.setItem('locale', e.target.value);
      }}
    >
      {Object.entries(locales).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
```

**完了条件:**
- [ ] Lingui設定完了
- [ ] en/ja カタログ作成
- [ ] i18nプロバイダー設定
- [ ] 言語切り替え機能実装
- [ ] メッセージ抽出ワークフロー確立（`bun lingui extract`）

---

## 3. UIコンポーネントライブラリ（Week 1-2）

**優先度:** 🟡 高（全UI実装の前提）
**ライブラリ:** [React Aria Components](https://react-spectrum.adobe.com/react-aria/) - アクセシブルなヘッドレスUIコンポーネント

### 3.1 React Aria Componentsセットアップ

```bash
# React Aria Components インストール
bun add react-aria-components
bun add -D tailwindcss-react-aria-components
```

### 3.2 Tailwind設定（React Aria対応）

```javascript
// tailwind.config.js
import { plugin } from 'tailwindcss-react-aria-components';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6',
          dark: '#2563eb',
        },
      },
    },
  },
  plugins: [plugin],
};
```

### 3.3 基本コンポーネント（React Aria Components版）

```typescript
// src/components/ui/Button.tsx
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-dark',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
        danger: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'h-9 px-3',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps extends AriaButtonProps, VariantProps<typeof buttonVariants> {}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <AriaButton
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}
```

```typescript
// src/components/ui/TextField.tsx
import { TextField as AriaTextField, Label, Input } from 'react-aria-components';
import { Trans } from '@lingui/macro';

interface TextFieldProps {
  label: string;
  description?: string;
  errorMessage?: string;
}

export function TextField({ label, description, errorMessage, ...props }: TextFieldProps) {
  return (
    <AriaTextField {...props} className="flex flex-col gap-1">
      <Label className="text-sm font-medium">{label}</Label>
      <Input className="rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
      {description && <div className="text-sm text-gray-600">{description}</div>}
      {errorMessage && <div className="text-sm text-red-600">{errorMessage}</div>}
    </AriaTextField>
  );
}
```

```typescript
// src/components/ui/Dialog.tsx
import {
  Dialog as AriaDialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
  Heading,
} from 'react-aria-components';
import { Trans } from '@lingui/macro';

export function Dialog({ title, children, trigger }: {
  title: string;
  children: React.ReactNode;
  trigger: React.ReactNode;
}) {
  return (
    <DialogTrigger>
      {trigger}
      <ModalOverlay className="fixed inset-0 bg-black/50">
        <Modal className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <AriaDialog>
            {({ close }) => (
              <>
                <Heading className="mb-4 text-xl font-bold">{title}</Heading>
                {children}
              </>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
```

**実装予定コンポーネント（React Aria Components）:**
- ✅ Button (AriaButton)
- ✅ TextField / TextArea (AriaTextField)
- ✅ Dialog / Modal (AriaDialog)
- [ ] Select / ComboBox (AriaSelect, AriaComboBox)
- [ ] Menu / Dropdown (AriaMenu)
- [ ] Tabs (AriaTabs)
- [ ] Switch (AriaSwitch)
- [ ] RadioGroup (AriaRadioGroup)
- [ ] DatePicker (AriaDatePicker)
- カスタムコンポーネント:
  - Avatar
  - Card
  - Loading Spinner
  - Toast / Alert

### 3.4 フォームコンポーネント（React Hook Form + React Aria）

```typescript
// src/components/ui/Form.tsx
import { useForm, Controller } from 'react-hook-form';
import { Form as AriaForm } from 'react-aria-components';
import { TextField } from './TextField';

interface FormProps {
  onSubmit: (data: any) => void;
  children: React.ReactNode;
}

export function Form({ onSubmit, children }: FormProps) {
  const { handleSubmit, control } = useForm();

  return (
    <AriaForm onSubmit={handleSubmit(onSubmit)}>
      {children}
    </AriaForm>
  );
}

// 使用例
export function LoginForm() {
  const { control, handleSubmit } = useForm();

  return (
    <AriaForm onSubmit={handleSubmit((data) => console.log(data))}>
      <Controller
        name="username"
        control={control}
        rules={{ required: true }}
        render={({ field, fieldState }) => (
          <TextField
            label={t`Username`}
            errorMessage={fieldState.error?.message}
            {...field}
          />
        )}
      />
    </AriaForm>
  );
}
```

### 3.5 レイアウトコンポーネント

```typescript
// src/app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <div className="container mx-auto">
            <div className="flex gap-4">
              <Sidebar />
              <main className="flex-1">{children}</main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
```

**完了条件:**
- [ ] React Aria Components基本セットアップ
- [ ] 全基本コンポーネント実装（Button, TextField, Dialog, Select, Menu）
- [ ] レスポンシブ対応
- [ ] アクセシビリティ対応（自動対応済み、React Ariaの利点）
- [ ] キーボードナビゲーション対応（自動対応済み）
- [ ] Tailwind CSSスタイリング
- [ ] ダークモード対応（オプション）

**React Aria Componentsの利点:**
- WAI-ARIA準拠の自動実装
- キーボードナビゲーション対応
- フォーカス管理
- スクリーンリーダー対応
- 国際化対応（RTL、日付フォーマットなど）
- モバイルタッチ対応

---

## 4. 認証フロー（Week 2）

**優先度:** 🔴 最高（全認証機能の前提）

### 3.1 認証状態管理（Jotai）

```typescript
// src/lib/atoms/auth.ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export const tokenAtom = atomWithStorage<string | null>('token', null);

export const currentUserAtom = atom<User | null>(null);

export const isAuthenticatedAtom = atom((get) => {
  return get(tokenAtom) !== null && get(currentUserAtom) !== null;
});
```

### 4.2 ログインページ（React Aria + Lingui対応）

```typescript
// src/app/login/page.tsx
'use client';

import { useAtom } from 'jotai';
import { useForm, Controller } from 'react-hook-form';
import { useRouter } from 'waku/router';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Form } from 'react-aria-components';
import { tokenAtom, currentUserAtom } from '@/lib/atoms/auth';
import { apiClient } from '@/lib/api/client';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';

interface LoginFormData {
  username: string;
  password: string;
}

export default function LoginPage() {
  const { _ } = useLingui();
  const router = useRouter();
  const [, setToken] = useAtom(tokenAtom);
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>();

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await apiClient.post('/api/auth/session', data);

      setToken(response.token);
      setCurrentUser(response.user);
      apiClient.setToken(response.token);

      router.push('/');
    } catch (error) {
      console.error('Login failed:', error);
      // TODO: Show error toast
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold">
          <Trans>Sign in to Rox</Trans>
        </h1>

        <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="username"
            control={control}
            rules={{ required: _(t`Username is required`) }}
            render={({ field, fieldState }) => (
              <TextField
                label={_(t`Username`)}
                errorMessage={fieldState.error?.message}
                isRequired
                {...field}
              />
            )}
          />

          <Controller
            name="password"
            control={control}
            rules={{ required: _(t`Password is required`) }}
            render={({ field, fieldState }) => (
              <TextField
                label={_(t`Password`)}
                type="password"
                errorMessage={fieldState.error?.message}
                isRequired
                {...field}
              />
            )}
          />

          <Button type="submit" isDisabled={isSubmitting} className="w-full">
            {isSubmitting ? <Trans>Signing in...</Trans> : <Trans>Sign in</Trans>}
          </Button>
        </Form>
      </div>
    </div>
  );
}
```

### 4.3 Protected Routes

```typescript
// src/components/auth/ProtectedRoute.tsx
'use client';

import { useAtom } from 'jotai';
import { useRouter } from 'waku/router';
import { useEffect } from 'react';
import { isAuthenticatedAtom } from '@/lib/atoms/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated] = useAtom(isAuthenticatedAtom);
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

**完了条件:**
- [ ] ログインページ実装
- [ ] サインアップページ実装
- [ ] 認証状態管理（Jotai）
- [ ] トークン永続化（localStorage）
- [ ] Protected Route実装
- [ ] 自動ログイン（トークン検証）

---

## 5. タイムライン実装（Week 2-3）

**優先度:** 🔴 最高（コア機能）

### 5.1 タイムライン（Server Component）

```typescript
// src/app/page.tsx (Server Component)
import { Timeline } from '@/components/timeline/Timeline';

export default async function HomePage() {
  // Server Componentで初期データ取得
  const initialNotes = await fetchLocalTimeline();

  return (
    <div>
      <h1>タイムライン</h1>
      <Timeline initialData={initialNotes} />
    </div>
  );
}

async function fetchLocalTimeline() {
  const response = await fetch('http://localhost:3000/api/notes/local-timeline', {
    cache: 'no-store',
  });
  return response.json();
}
```

### 5.2 タイムラインコンポーネント（Client Component）

```typescript
// src/components/timeline/Timeline.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { NoteCard } from '@/components/note/NoteCard';
import { timelineAtom } from '@/lib/atoms/timeline';

interface TimelineProps {
  initialData: Note[];
}

export function Timeline({ initialData }: TimelineProps) {
  const [notes, setNotes] = useAtom(timelineAtom);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNotes(initialData);
  }, [initialData, setNotes]);

  const loadMore = async () => {
    if (loading || notes.length === 0) return;

    setLoading(true);
    const lastNote = notes[notes.length - 1];

    try {
      const moreNotes = await apiClient.get(
        `/api/notes/local-timeline?untilId=${lastNote.id}`
      );
      setNotes([...notes, ...moreNotes]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
      <button onClick={loadMore} disabled={loading}>
        {loading ? '読み込み中...' : 'もっと見る'}
      </button>
    </div>
  );
}
```

### 5.3 ノートカード

```typescript
// src/components/note/NoteCard.tsx
'use client';

export function NoteCard({ note }: { note: Note }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      {/* ユーザー情報 */}
      <div className="flex items-center gap-2">
        <Avatar src={note.user.avatarUrl} />
        <div>
          <div className="font-bold">{note.user.displayName}</div>
          <div className="text-sm text-gray-500">@{note.user.username}</div>
        </div>
      </div>

      {/* CW */}
      {note.cw && (
        <div className="mt-2 text-sm text-gray-600">
          CW: {note.cw}
        </div>
      )}

      {/* 本文 */}
      {note.text && (
        <div className="mt-2 whitespace-pre-wrap">{note.text}</div>
      )}

      {/* 画像 */}
      {note.files && note.files.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {note.files.map((file) => (
            <img
              key={file.id}
              src={file.thumbnailUrl || file.url}
              alt=""
              className="rounded"
            />
          ))}
        </div>
      )}

      {/* アクション */}
      <div className="mt-4 flex gap-4">
        <button>💬 リプライ</button>
        <button>🔁 Renote</button>
        <button>❤️ リアクション</button>
      </div>
    </div>
  );
}
```

### 5.4 無限スクロール

```typescript
// src/hooks/useInfiniteScroll.ts
import { useEffect, useRef } from 'react';

export function useInfiniteScroll(callback: () => void) {
  const observer = useRef<IntersectionObserver>();
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          callback();
        }
      },
      { threshold: 1.0 }
    );

    if (targetRef.current) {
      observer.current.observe(targetRef.current);
    }

    return () => {
      observer.current?.disconnect();
    };
  }, [callback]);

  return targetRef;
}
```

**完了条件:**
- [ ] タイムライン表示（RSC活用）
- [ ] 無限スクロールページネーション
- [ ] Pull-to-refresh（モバイル）
- [ ] ノートカード実装
- [ ] 画像ギャラリー
- [ ] リアルタイム更新（ポーリング or WebSocket）

---

## 6. 投稿機能（Week 3）

**優先度:** 🔴 最高

### 6.1 ノート投稿コンポーザー

```typescript
// src/components/note/NoteComposer.tsx
'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';

export function NoteComposer() {
  const [text, setText] = useState('');
  const [cw, setCw] = useState('');
  const [showCw, setShowCw] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<Visibility>('public');

  const handlePost = async () => {
    // ファイルアップロード
    const fileIds = await Promise.all(
      files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const uploaded = await apiClient.post('/api/drive/files/create', formData);
        return uploaded.id;
      })
    );

    // ノート作成
    await apiClient.post('/api/notes/create', {
      text,
      cw: showCw ? cw : undefined,
      visibility,
      fileIds,
    });

    // リセット
    setText('');
    setCw('');
    setFiles([]);
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      {showCw && (
        <Input
          placeholder="注意書き（CW）"
          value={cw}
          onChange={(e) => setCw(e.target.value)}
        />
      )}
      <Textarea
        placeholder="いまどうしてる？"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setShowCw(!showCw)}>CW</button>
          <FileUploadButton onSelect={setFiles} />
          <EmojiPicker />
        </div>
        <div className="flex items-center gap-2">
          <VisibilitySelector value={visibility} onChange={setVisibility} />
          <Button onClick={handlePost}>投稿</Button>
        </div>
      </div>
    </div>
  );
}
```

**完了条件:**
- [ ] テキスト入力
- [ ] ファイル添付（ドラッグ&ドロップ）
- [ ] 絵文字ピッカー
- [ ] CW設定
- [ ] 公開範囲選択
- [ ] 文字数カウンター
- [ ] 下書き保存（localStorage）
- [ ] Optimistic Update

---

## 7. ユーザーインタラクション（Week 3-4）

**完了条件:**
- [ ] リプライ機能
- [ ] Renote機能
- [ ] リアクションピッカー
- [ ] フォロー/アンフォローボタン
- [ ] ユーザープロフィールページ
- [ ] ノート詳細ページ

---

## 8. パフォーマンス最適化（Week 4）

**実施項目:**
- [ ] 画像遅延読み込み
- [ ] コンポーネント分割・Code Splitting
- [ ] Bundle Size最適化
- [ ] Lighthouse Performance > 90
- [ ] Core Web Vitals改善

---

## 完了条件（Phase 2全体）

- [ ] 全ユーザーフロー動作
- [ ] レスポンシブ対応
- [ ] Lighthouse Performance > 90
- [ ] Accessibility > 90
- [ ] クロスブラウザ動作確認

## 次フェーズ

Phase 2完了後、必要に応じてUI/UX改善を継続しつつ、Phase 3（連合）またはその他の機能拡張に進む。

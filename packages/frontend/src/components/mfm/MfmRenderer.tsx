'use client';

/**
 * MFM (Misskey Flavored Markdown) Renderer Component
 *
 * Parses and renders MFM text into React components.
 * Supports:
 * - Bold, italic, strikethrough text
 * - Code blocks and inline code
 * - Mentions (@user, @user@host)
 * - Hashtags (#tag)
 * - URLs and links
 * - Custom emoji (:emoji:)
 * - MFM functions ($[fn.args content])
 * - Math formulas (KaTeX)
 * - Block quotes
 */

import { useMemo, useState, useEffect, type ReactNode } from 'react';
import * as mfm from 'mfm-js';
import type { MfmNode } from 'mfm-js';
import { lookupEmojis } from '../../lib/atoms/customEmoji';

/**
 * Props for MfmRenderer component
 */
export interface MfmRendererProps {
  /** MFM text to render */
  text: string;
  /** Custom emoji map (name -> URL) */
  customEmojis?: Record<string, string>;
  /** Whether to render as plain text (no formatting) */
  plain?: boolean;
  /** Maximum nesting depth for MFM parsing */
  nestLimit?: number;
  /** Base URL for mentions (default: current origin) */
  mentionBaseUrl?: string;
  /** Callback when a mention is clicked */
  onMentionClick?: (username: string, host?: string) => void;
  /** Callback when a hashtag is clicked */
  onHashtagClick?: (tag: string) => void;
  /** Class name for the wrapper element */
  className?: string;
}

/**
 * MFM Renderer Component
 *
 * Parses MFM text and renders it as React components with proper styling.
 *
 * @example
 * ```tsx
 * <MfmRenderer text="Hello **world**! $[spin :tada:]" />
 * ```
 */
export function MfmRenderer({
  text,
  customEmojis = {},
  plain = false,
  nestLimit = 20,
  mentionBaseUrl = '',
  onMentionClick,
  onHashtagClick,
  className = '',
}: MfmRendererProps) {
  // State for fetched custom emojis
  const [fetchedEmojis, setFetchedEmojis] = useState<Record<string, string>>({});

  // Parse MFM text into AST
  const nodes = useMemo(() => {
    if (!text) return [];
    try {
      return plain ? mfm.parseSimple(text) : mfm.parse(text, { nestLimit });
    } catch (error) {
      console.error('MFM parse error:', error);
      return [{ type: 'text', props: { text } } as MfmNode];
    }
  }, [text, plain, nestLimit]);

  // Extract custom emoji names from AST
  const emojiNames = useMemo(() => {
    const names: string[] = [];
    const collectEmojiNames = (nodeList: MfmNode[]) => {
      for (const node of nodeList) {
        if (node.type === 'emojiCode') {
          names.push(node.props.name);
        }
        if (node.children) {
          collectEmojiNames(node.children);
        }
      }
    };
    collectEmojiNames(nodes);
    return names;
  }, [nodes]);

  // Fetch custom emoji URLs
  useEffect(() => {
    // Skip if no emoji names to look up or if all are already provided via props
    const missingEmojis = emojiNames.filter(
      (name) => !customEmojis[name] && !customEmojis[`:${name}:`]
    );

    if (missingEmojis.length === 0) return;

    let cancelled = false;

    lookupEmojis(missingEmojis).then((emojiMap) => {
      if (cancelled) return;

      const newEmojis: Record<string, string> = {};
      for (const [name, url] of emojiMap) {
        newEmojis[name] = url;
      }

      if (Object.keys(newEmojis).length > 0) {
        setFetchedEmojis((prev) => ({ ...prev, ...newEmojis }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [emojiNames, customEmojis]);

  // Merge provided and fetched emojis
  const mergedEmojis = useMemo(() => {
    return { ...fetchedEmojis, ...customEmojis };
  }, [customEmojis, fetchedEmojis]);

  // Render a single MFM node
  const renderNode = (node: MfmNode, index: number): ReactNode => {
    switch (node.type) {
      case 'text':
        return <span key={index}>{node.props.text}</span>;

      case 'bold':
        return (
          <strong key={index} className="font-bold">
            {node.children?.map((child, i) => renderNode(child, i))}
          </strong>
        );

      case 'italic':
        return (
          <em key={index} className="italic">
            {node.children?.map((child, i) => renderNode(child, i))}
          </em>
        );

      case 'strike':
        return (
          <del key={index} className="line-through">
            {node.children?.map((child, i) => renderNode(child, i))}
          </del>
        );

      case 'small':
        return (
          <small key={index} className="text-sm opacity-70">
            {node.children?.map((child, i) => renderNode(child, i))}
          </small>
        );

      case 'center':
        return (
          <div key={index} className="text-center">
            {node.children?.map((child, i) => renderNode(child, i))}
          </div>
        );

      case 'inlineCode':
        return (
          <code
            key={index}
            className="px-1.5 py-0.5 rounded bg-(--bg-tertiary) font-mono text-sm"
          >
            {node.props.code}
          </code>
        );

      case 'blockCode':
        return (
          <pre
            key={index}
            className="p-3 rounded-lg bg-(--bg-tertiary) overflow-x-auto my-2"
          >
            <code className="font-mono text-sm whitespace-pre">
              {node.props.code}
            </code>
          </pre>
        );

      case 'quote':
        return (
          <blockquote
            key={index}
            className="border-l-4 border-(--border-color) pl-3 my-2 text-(--text-muted)"
          >
            {node.children?.map((child, i) => renderNode(child, i))}
          </blockquote>
        );

      case 'url':
        return (
          <a
            key={index}
            href={node.props.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-500 hover:underline break-all"
          >
            {node.props.url}
          </a>
        );

      case 'link':
        return (
          <a
            key={index}
            href={node.props.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-primary-500 hover:underline ${node.props.silent ? '' : ''}`}
          >
            {node.children?.map((child, i) => renderNode(child, i))}
          </a>
        );

      case 'mention':
        const mentionUsername = node.props.username;
        const mentionHost = node.props.host;
        const mentionHref = mentionHost
          ? `${mentionBaseUrl}/@${mentionUsername}@${mentionHost}`
          : `${mentionBaseUrl}/${mentionUsername}`;

        return (
          <a
            key={index}
            href={mentionHref}
            className="text-primary-500 hover:underline"
            onClick={(e) => {
              if (onMentionClick) {
                e.preventDefault();
                onMentionClick(mentionUsername, mentionHost ?? undefined);
              }
            }}
          >
            @{mentionUsername}
            {mentionHost && `@${mentionHost}`}
          </a>
        );

      case 'hashtag':
        const tag = node.props.hashtag;
        return (
          <a
            key={index}
            href={`/tags/${encodeURIComponent(tag)}`}
            className="text-primary-500 hover:underline"
            onClick={(e) => {
              if (onHashtagClick) {
                e.preventDefault();
                onHashtagClick(tag);
              }
            }}
          >
            #{tag}
          </a>
        );

      case 'emojiCode':
        const emojiName = node.props.name;
        const emojiUrl = mergedEmojis[emojiName] || mergedEmojis[`:${emojiName}:`];

        if (emojiUrl) {
          return (
            <img
              key={index}
              src={emojiUrl}
              alt={`:${emojiName}:`}
              title={`:${emojiName}:`}
              className="inline-block h-6 w-6 align-middle mx-0.5"
              loading="lazy"
            />
          );
        }
        // Fallback: show as text if custom emoji not found
        return <span key={index}>:{emojiName}:</span>;

      case 'unicodeEmoji':
        return (
          <span key={index} className="text-lg">
            {node.props.emoji}
          </span>
        );

      case 'mathInline':
        // TODO: Integrate KaTeX for math rendering
        return (
          <code key={index} className="px-1 bg-(--bg-tertiary) rounded">
            {node.props.formula}
          </code>
        );

      case 'mathBlock':
        // TODO: Integrate KaTeX for math rendering
        return (
          <pre key={index} className="p-3 rounded-lg bg-(--bg-tertiary) my-2 overflow-x-auto">
            <code>{node.props.formula}</code>
          </pre>
        );

      case 'search':
        const query = node.props.query;
        return (
          <a
            key={index}
            href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-(--bg-tertiary) text-primary-500 hover:underline"
          >
            <span>🔍</span>
            <span>{query}</span>
          </a>
        );

      case 'fn':
        // MFM functions like $[spin content], $[tada content], etc.
        return renderMfmFunction(node, index);

      case 'plain':
        return (
          <span key={index}>
            {node.children?.map((child, i) => renderNode(child, i))}
          </span>
        );

      default: {
        // For unknown node types, try to render children or return empty
        const unknownNode = node as { children?: MfmNode[] };
        if (unknownNode.children && Array.isArray(unknownNode.children)) {
          return (
            <span key={index}>
              {unknownNode.children.map((child: MfmNode, i: number) => renderNode(child, i))}
            </span>
          );
        }
        return null;
      }
    }
  };

  // Render MFM functions (animations and effects)
  const renderMfmFunction = (node: MfmNode & { type: 'fn' }, index: number): ReactNode => {
    const fnName = node.props.name;
    const args = node.props.args || {};
    const children = node.children?.map((child, i) => renderNode(child, i));

    // CSS class based on function name
    const fnClasses: Record<string, string> = {
      // Animations
      tada: 'mfm-tada',
      jelly: 'mfm-jelly',
      twitch: 'mfm-twitch',
      shake: 'mfm-shake',
      spin: 'mfm-spin',
      jump: 'mfm-jump',
      bounce: 'mfm-bounce',
      rainbow: 'mfm-rainbow',
      sparkle: 'mfm-sparkle',

      // Transforms
      flip: 'mfm-flip',
      x2: 'mfm-x2',
      x3: 'mfm-x3',
      x4: 'mfm-x4',

      // Blur
      blur: 'mfm-blur',

      // Font
      font: 'mfm-font',

      // Position
      position: 'mfm-position',
      scale: 'mfm-scale',
      rotate: 'mfm-rotate',

      // Colors (handled separately with inline style)
      fg: '',
      bg: '',
    };

    let style: React.CSSProperties = {};
    let className = fnClasses[fnName] || '';

    // Handle specific function arguments
    switch (fnName) {
      case 'spin':
        if (args.left) className += ' mfm-spin-left';
        if (args.alternate) className += ' mfm-spin-alternate';
        if (args.x) className += ' mfm-spin-x';
        if (args.y) className += ' mfm-spin-y';
        if (args.speed && typeof args.speed === 'string') {
          style.animationDuration = args.speed;
        }
        break;

      case 'flip':
        if (args.h) className += ' mfm-flip-h';
        if (args.v) className += ' mfm-flip-v';
        break;

      case 'fg':
        if (args.color && typeof args.color === 'string') {
          style.color = args.color.startsWith('#') ? args.color : `#${args.color}`;
        }
        break;

      case 'bg':
        if (args.color && typeof args.color === 'string') {
          style.backgroundColor = args.color.startsWith('#') ? args.color : `#${args.color}`;
        }
        break;

      case 'font':
        if (args.serif) style.fontFamily = 'serif';
        if (args.monospace) style.fontFamily = 'monospace';
        if (args.cursive) style.fontFamily = 'cursive';
        if (args.fantasy) style.fontFamily = 'fantasy';
        break;

      case 'rotate':
        if (args.deg && typeof args.deg === 'string') {
          style.transform = `rotate(${args.deg}deg)`;
          style.display = 'inline-block';
        }
        break;

      case 'scale': {
        const scaleX = typeof args.x === 'string' ? args.x : '1';
        const scaleY = typeof args.y === 'string' ? args.y : '1';
        style.transform = `scale(${scaleX}, ${scaleY})`;
        style.display = 'inline-block';
        break;
      }

      case 'position':
        if (args.x && typeof args.x === 'string') style.marginLeft = `${args.x}em`;
        if (args.y && typeof args.y === 'string') style.marginTop = `${args.y}em`;
        break;
    }

    return (
      <span key={index} className={className} style={style}>
        {children}
      </span>
    );
  };

  if (!text) return null;

  return (
    <span className={`mfm ${className}`}>
      {nodes.map((node, index) => renderNode(node, index))}
    </span>
  );
}

export default MfmRenderer;

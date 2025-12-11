"use client";

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

import { useMemo, useState, useEffect, useRef, memo, type ReactNode } from "react";
import * as mfm from "mfm-js";
import type { MfmNode } from "mfm-js";
import katex from "katex";
import { lookupEmojis } from "../../lib/atoms/customEmoji";
import { containsHtml, htmlToMfm } from "../../lib/utils/htmlToText";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";

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
function MfmRendererComponent({
  text,
  customEmojis = {},
  plain = false,
  nestLimit = 20,
  mentionBaseUrl = "",
  onMentionClick,
  onHashtagClick,
  className = "",
}: MfmRendererProps) {
  // Convert HTML to MFM if needed (for remote ActivityPub content)
  const processedText = useMemo(() => {
    if (!text) return "";
    // If text contains HTML tags, convert to MFM-compatible format
    if (containsHtml(text)) {
      return htmlToMfm(text);
    }
    return text;
  }, [text]);

  // Parse MFM text into AST with safety limits
  const nodes = useMemo(() => {
    if (!processedText) return [];
    // Limit text length to prevent DoS from very long content
    const safeText = processedText.length > 10000
      ? processedText.slice(0, 10000) + "..."
      : processedText;
    try {
      return plain ? mfm.parseSimple(safeText) : mfm.parse(safeText, { nestLimit });
    } catch (error) {
      console.error("MFM parse error:", error);
      return [{ type: "text", props: { text: safeText } } as MfmNode];
    }
  }, [processedText, plain, nestLimit]);

  // State for fetched custom emojis - use ref to avoid triggering re-renders
  const fetchedEmojisRef = useRef<Record<string, string>>({});
  const [fetchedEmojisVersion, setFetchedEmojisVersion] = useState(0);
  const pendingFetchRef = useRef<Set<string>>(new Set());

  // Regex to match :emoji_name@host: format (not parsed by mfm-js)
  const remoteEmojiRegex = /:([a-zA-Z0-9_]+)@([a-zA-Z0-9.-]+):/g;

  // Extract custom emoji names from AST (including remote emoji in text nodes)
  const emojiNames = useMemo(() => {
    const names: string[] = [];
    const collectEmojiNames = (nodeList: MfmNode[]) => {
      for (const node of nodeList) {
        if (node.type === "emojiCode") {
          names.push(node.props.name);
        }
        // Also check text nodes for :name@host: format (not parsed by mfm-js)
        if (node.type === "text" && node.props.text) {
          const text = node.props.text as string;
          const matches = text.matchAll(remoteEmojiRegex);
          for (const match of matches) {
            const name = match[1];
            const host = match[2];
            names.push(`${name}@${host}`);
          }
        }
        if (node.children) {
          collectEmojiNames(node.children);
        }
      }
    };
    collectEmojiNames(nodes);
    return names;
  }, [nodes]);

  // Fetch custom emoji URLs - uses refs to prevent re-render loops
  useEffect(() => {
    const missingEmojis = emojiNames.filter(
      (name) =>
        !customEmojis[name] &&
        !customEmojis[`:${name}:`] &&
        !fetchedEmojisRef.current[name] &&
        !pendingFetchRef.current.has(name),
    );
    if (missingEmojis.length === 0) return;

    // Mark as pending to prevent duplicate fetches
    for (const name of missingEmojis) {
      pendingFetchRef.current.add(name);
    }

    lookupEmojis(missingEmojis).then((emojiMap) => {
      let hasNewEmojis = false;
      for (const [name, url] of emojiMap) {
        if (!fetchedEmojisRef.current[name]) {
          fetchedEmojisRef.current[name] = url;
          hasNewEmojis = true;
        }
        pendingFetchRef.current.delete(name);
      }
      // Also remove any emojis that weren't found from pending
      for (const name of missingEmojis) {
        pendingFetchRef.current.delete(name);
      }
      // Trigger a single re-render if we got new emojis
      if (hasNewEmojis) {
        setFetchedEmojisVersion((v) => v + 1);
      }
    });
  }, [emojiNames, customEmojis]);

  // Merge provided and fetched emojis - fetchedEmojisVersion triggers re-computation
  const mergedEmojis = useMemo(() => {
    return { ...fetchedEmojisRef.current, ...customEmojis };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customEmojis, fetchedEmojisVersion]);

  // Render remote emoji (:name@host: format) as image
  const renderRemoteEmoji = (nameWithHost: string, key: string): ReactNode => {
    const emojiUrl = mergedEmojis[nameWithHost];
    if (emojiUrl) {
      return (
        <img
          key={key}
          src={getProxiedImageUrl(emojiUrl) || ""}
          alt={`:${nameWithHost}:`}
          title={`:${nameWithHost}:`}
          className="inline-block h-[1.25em] w-auto max-w-[4em] mx-0.5 object-contain"
          style={{ verticalAlign: "-0.2em" }}
          loading="lazy"
        />
      );
    }
    // Fallback: show as text if emoji not found
    return <span key={key}>:{nameWithHost}:</span>;
  };

  // Render text with remote emoji support (:name@host: format)
  const renderTextWithRemoteEmoji = (text: string, baseKey: number): ReactNode => {
    // Check if text contains any :name@host: patterns
    const pattern = /:([a-zA-Z0-9_]+)@([a-zA-Z0-9.-]+):/g;
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let partIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      // Add text before the emoji
      if (match.index > lastIndex) {
        parts.push(<span key={`${baseKey}-${partIndex++}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      // Add the emoji
      const nameWithHost = `${match[1]}@${match[2]}`;
      parts.push(renderRemoteEmoji(nameWithHost, `${baseKey}-${partIndex++}`));
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last emoji
    if (lastIndex < text.length) {
      parts.push(<span key={`${baseKey}-${partIndex++}`}>{text.slice(lastIndex)}</span>);
    }

    // If no remote emojis found, return simple text
    if (parts.length === 0) {
      return <span key={baseKey}>{text}</span>;
    }

    return <span key={baseKey}>{parts}</span>;
  };

  // Render a single MFM node
  const renderNode = (node: MfmNode, index: number): ReactNode => {
    switch (node.type) {
      case "text":
        return renderTextWithRemoteEmoji(node.props.text, index);

      case "bold":
        return (
          <strong key={index} className="font-bold">
            {node.children?.map((child, i) => renderNode(child, i))}
          </strong>
        );

      case "italic":
        return (
          <em key={index} className="italic">
            {node.children?.map((child, i) => renderNode(child, i))}
          </em>
        );

      case "strike":
        return (
          <del key={index} className="line-through">
            {node.children?.map((child, i) => renderNode(child, i))}
          </del>
        );

      case "small":
        return (
          <small key={index} className="text-sm opacity-70">
            {node.children?.map((child, i) => renderNode(child, i))}
          </small>
        );

      case "center":
        return (
          <div key={index} className="text-center">
            {node.children?.map((child, i) => renderNode(child, i))}
          </div>
        );

      case "inlineCode":
        return (
          <code key={index} className="px-1.5 py-0.5 rounded bg-(--bg-tertiary) font-mono text-sm">
            {node.props.code}
          </code>
        );

      case "blockCode":
        return (
          <pre key={index} className="p-3 rounded-lg bg-(--bg-tertiary) overflow-x-auto my-2">
            <code className="font-mono text-sm whitespace-pre">{node.props.code}</code>
          </pre>
        );

      case "quote":
        return (
          <blockquote
            key={index}
            className="border-l-4 border-(--border-color) pl-3 my-2 text-(--text-muted)"
          >
            {node.children?.map((child, i) => renderNode(child, i))}
          </blockquote>
        );

      case "url":
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

      case "link":
        return (
          <a
            key={index}
            href={node.props.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-primary-500 hover:underline ${node.props.silent ? "" : ""}`}
          >
            {node.children?.map((child, i) => renderNode(child, i))}
          </a>
        );

      case "mention":
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

      case "hashtag":
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

      case "emojiCode":
        const emojiName = node.props.name;
        const emojiUrl = mergedEmojis[emojiName] || mergedEmojis[`:${emojiName}:`];

        if (emojiUrl) {
          return (
            <img
              key={index}
              src={getProxiedImageUrl(emojiUrl) || ""}
              alt={`:${emojiName}:`}
              title={`:${emojiName}:`}
              className="inline-block h-[1.25em] w-auto max-w-[4em] mx-0.5 object-contain"
              style={{ verticalAlign: "-0.2em" }}
              loading="lazy"
            />
          );
        }
        // Fallback: show as text if custom emoji not found
        return <span key={index}>:{emojiName}:</span>;

      case "unicodeEmoji":
        return (
          <span key={index} className="text-lg">
            {node.props.emoji}
          </span>
        );

      case "mathInline":
        try {
          const inlineHtml = katex.renderToString(node.props.formula, {
            throwOnError: false,
            displayMode: false,
            strict: false,
          });
          return (
            <span
              key={index}
              className="katex-inline"
              dangerouslySetInnerHTML={{ __html: inlineHtml }}
            />
          );
        } catch {
          // Fallback to code display if KaTeX fails
          return (
            <code key={index} className="px-1 bg-(--bg-tertiary) rounded">
              {node.props.formula}
            </code>
          );
        }

      case "mathBlock":
        try {
          const blockHtml = katex.renderToString(node.props.formula, {
            throwOnError: false,
            displayMode: true,
            strict: false,
          });
          return (
            <div
              key={index}
              className="katex-block my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: blockHtml }}
            />
          );
        } catch {
          // Fallback to code display if KaTeX fails
          return (
            <pre key={index} className="p-3 rounded-lg bg-(--bg-tertiary) my-2 overflow-x-auto">
              <code>{node.props.formula}</code>
            </pre>
          );
        }

      case "search":
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

      case "fn":
        // MFM functions like $[spin content], $[tada content], etc.
        return renderMfmFunction(node, index);

      case "plain":
        return <span key={index}>{node.children?.map((child, i) => renderNode(child, i))}</span>;

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
  const renderMfmFunction = (node: MfmNode & { type: "fn" }, index: number): ReactNode => {
    const fnName = node.props.name;
    const args = node.props.args || {};
    const children = node.children?.map((child, i) => renderNode(child, i));

    // CSS class based on function name
    const fnClasses: Record<string, string> = {
      // Animations
      tada: "mfm-tada",
      jelly: "mfm-jelly",
      twitch: "mfm-twitch",
      shake: "mfm-shake",
      spin: "mfm-spin",
      jump: "mfm-jump",
      bounce: "mfm-bounce",
      rainbow: "mfm-rainbow",
      sparkle: "mfm-sparkle",

      // Transforms
      flip: "mfm-flip",
      x2: "mfm-x2",
      x3: "mfm-x3",
      x4: "mfm-x4",

      // Blur
      blur: "mfm-blur",

      // Font
      font: "mfm-font",

      // Position
      position: "mfm-position",
      scale: "mfm-scale",
      rotate: "mfm-rotate",

      // Colors (handled separately with inline style)
      fg: "",
      bg: "",
    };

    let style: React.CSSProperties = {};
    let className = fnClasses[fnName] || "";

    // Handle specific function arguments
    switch (fnName) {
      case "spin":
        if (args.left) className += " mfm-spin-left";
        if (args.alternate) className += " mfm-spin-alternate";
        if (args.x) className += " mfm-spin-x";
        if (args.y) className += " mfm-spin-y";
        if (args.speed && typeof args.speed === "string") {
          style.animationDuration = args.speed;
        }
        break;

      case "flip":
        if (args.h) className += " mfm-flip-h";
        if (args.v) className += " mfm-flip-v";
        break;

      case "fg":
        if (args.color && typeof args.color === "string") {
          style.color = args.color.startsWith("#") ? args.color : `#${args.color}`;
        }
        break;

      case "bg":
        if (args.color && typeof args.color === "string") {
          style.backgroundColor = args.color.startsWith("#") ? args.color : `#${args.color}`;
        }
        break;

      case "font":
        if (args.serif) style.fontFamily = "serif";
        if (args.monospace) style.fontFamily = "monospace";
        if (args.cursive) style.fontFamily = "cursive";
        if (args.fantasy) style.fontFamily = "fantasy";
        break;

      case "rotate":
        if (args.deg && typeof args.deg === "string") {
          style.transform = `rotate(${args.deg}deg)`;
          style.display = "inline-block";
        }
        break;

      case "scale": {
        const scaleX = typeof args.x === "string" ? args.x : "1";
        const scaleY = typeof args.y === "string" ? args.y : "1";
        style.transform = `scale(${scaleX}, ${scaleY})`;
        style.display = "inline-block";
        break;
      }

      case "position":
        if (args.x && typeof args.x === "string") style.marginLeft = `${args.x}em`;
        if (args.y && typeof args.y === "string") style.marginTop = `${args.y}em`;
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

// Memoize to prevent unnecessary re-renders
export const MfmRenderer = memo(MfmRendererComponent);
export default MfmRenderer;

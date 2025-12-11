"use client";

/**
 * User QR Code Modal Component
 *
 * Modal to display a QR code for following a user from another ActivityPub server.
 * The QR code links to an interaction page that facilitates remote following.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { X, Copy, Check, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { User } from "../../lib/api/users";
import { getProxiedImageUrl } from "../../lib/utils/imageProxy";
import { Button } from "../ui/Button";
import { UserDisplayName } from "./UserDisplayName";

/**
 * Props for the UserQRCodeModal component
 */
export interface UserQRCodeModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** User to generate QR code for */
  user: User;
}

/**
 * Modal to display QR code for remote following
 */
export function UserQRCodeModal({ isOpen, onClose, user }: UserQRCodeModalProps) {
  const { _ } = useLingui();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Get the current instance host
  const instanceHost =
    typeof window !== "undefined"
      ? window.location.host
      : process.env.URL?.replace(/^https?:\/\//, "") || "localhost";

  // Generate the interact URL for the QR code
  const interactUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/interact?acct=${user.username}`
      : `https://${instanceHost}/interact?acct=${user.username}`;

  // Full WebFinger address
  const webFingerAddress = `@${user.username}@${instanceHost}`;

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Handle copy link
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(interactUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [interactUrl]);

  // Handle download QR code
  const handleDownload = useCallback(() => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    // Create a canvas element
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size (with padding)
    const padding = 32;
    const qrSize = 200;
    canvas.width = qrSize + padding * 2;
    canvas.height = qrSize + padding * 2;

    // Fill background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convert SVG to data URL
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      // Draw QR code centered with padding
      ctx.drawImage(img, padding, padding, qrSize, qrSize);
      URL.revokeObjectURL(svgUrl);

      // Download the image
      const link = document.createElement("a");
      link.download = `${user.username}-qrcode.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = svgUrl;
  }, [user.username]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative w-full max-w-xs bg-(--card-bg) rounded-xl shadow-xl overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 hover:bg-(--bg-secondary) rounded-full transition-colors z-10"
          aria-label={_(t`Close`)}
        >
          <X className="w-5 h-5 text-(--text-muted)" />
        </button>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-3">
            {user.avatarUrl ? (
              <img
                src={getProxiedImageUrl(user.avatarUrl) || ""}
                alt={user.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-500 dark:text-gray-400">
                {user.username[0]?.toUpperCase()}
              </div>
            )}
          </div>

          {/* Display Name */}
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            <UserDisplayName
              name={user.displayName}
              username={user.username}
              profileEmojis={user.profileEmojis}
            />
          </h2>

          {/* Handle */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{webFingerAddress}</p>

          {/* QR Code */}
          <div
            ref={qrRef}
            className="bg-white p-4 rounded-lg shadow-inner mb-4"
          >
            <QRCodeSVG
              value={interactUrl}
              size={200}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            <Trans>Scan to follow from another server</Trans>
          </p>

          {/* Action Buttons */}
          <div className="flex gap-2 w-full">
            <Button variant="secondary" onPress={handleCopy} className="flex-1">
              {copied ? (
                <div className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-green-500" />
                  <Trans>Copied!</Trans>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Copy className="w-4 h-4" />
                  <Trans>Copy link</Trans>
                </div>
              )}
            </Button>
            <Button variant="secondary" onPress={handleDownload}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

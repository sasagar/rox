/**
 * Asset Upload Card Component
 *
 * Reusable component for uploading server assets (icon, banner, favicon)
 */

import { useRef } from "react";
import { Trans } from "@lingui/react/macro";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

type AssetType = "icon" | "darkIcon" | "banner" | "favicon" | "pwaIcon192" | "pwaIcon512" | "pwaMaskableIcon192" | "pwaMaskableIcon512";

interface AssetUploadCardProps {
  type: AssetType;
  title: React.ReactNode;
  description: React.ReactNode;
  currentUrl: string | null;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
  previewClassName?: string;
}

/**
 * Asset Upload Card
 *
 * Displays an asset with upload/remove functionality
 */
export function AssetUploadCard({
  type,
  title,
  description,
  currentUrl,
  isUploading,
  onUpload,
  onDelete,
  previewClassName = "w-16 h-16 rounded-lg",
}: AssetUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    e.target.value = "";
  };

  return (
    <div className="border border-(--border-color) rounded-lg p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-(--text-primary)">{title}</h4>
          <p className="text-sm text-(--text-muted) mt-1">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onPress={handleFileSelect}
            isDisabled={isUploading}
          >
            {isUploading ? <Spinner size="xs" /> : <Trans>Upload</Trans>}
          </Button>
          {currentUrl && (
            <Button
              variant="danger"
              size="sm"
              onPress={onDelete}
              isDisabled={isUploading}
            >
              <Trans>Remove</Trans>
            </Button>
          )}
        </div>
      </div>
      {currentUrl && (
        <div className="mt-4">
          <img
            src={currentUrl}
            alt={`${type} preview`}
            className={`${previewClassName} object-cover border border-(--border-color)`}
          />
        </div>
      )}
    </div>
  );
}

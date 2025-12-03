"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Trans } from "@lingui/react/macro";
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useFocusTrap } from "../../hooks/useFocusTrap";

/**
 * Image modal/lightbox component with zoom and gallery support
 */

export interface ImageModalProps {
  /** Array of image URLs */
  images: string[];
  /** Initial image index to display */
  initialIndex?: number;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Alt text for images */
  alt?: string;
}

/**
 * Full-screen image modal with zoom, pan, and gallery navigation
 */
export function ImageModal({ images, initialIndex = 0, onClose, alt = "Image" }: ImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const currentImage = images[currentIndex];
  const hasMultipleImages = images.length > 1;

  // Focus trap for modal
  useFocusTrap(modalRef, {
    initialFocusRef: closeButtonRef,
    onEscape: onClose,
  });

  // Navigate to previous image
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [currentIndex]);

  // Navigate to next image
  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [currentIndex, images.length]);

  // Zoom in
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.5, 3));
  }, []);

  // Zoom out
  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Mouse drag handlers for panning
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom > 1) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [zoom, position],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && zoom > 1) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, zoom],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard navigation (excluding Escape, which is handled by useFocusTrap)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          handlePrevious();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
        case "0":
          handleResetZoom();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrevious, handleNext, handleZoomIn, handleZoomOut, handleResetZoom]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Close button */}
      <button
        ref={closeButtonRef}
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
        aria-label="Close"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Image counter */}
      {hasMultipleImages && (
        <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded z-10">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-black/50 px-4 py-2 rounded-lg z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          disabled={zoom <= 1}
          className="text-white hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-6 h-6" />
        </button>

        <span className="text-white text-sm min-w-12 text-center">{Math.round(zoom * 100)}%</span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          disabled={zoom >= 3}
          className="text-white hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-6 h-6" />
        </button>

        {zoom > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleResetZoom();
            }}
            className="text-white hover:text-gray-300 transition-colors ml-2 text-sm"
          >
            <Trans>Reset</Trans>
          </button>
        )}
      </div>

      {/* Previous button */}
      {hasMultipleImages && currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrevious();
          }}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Next button */}
      {hasMultipleImages && currentIndex < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 transition-colors bg-black/50 rounded-full p-2"
          aria-label="Next image"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Image container */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        <img
          src={currentImage}
          alt={`${alt} ${currentIndex + 1}`}
          className="max-w-full max-h-[90vh] object-contain transition-transform"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            transformOrigin: "center",
          }}
          draggable={false}
        />
      </div>

      {/* Thumbnail gallery for multiple images */}
      {hasMultipleImages && images.length <= 10 && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black/50 px-4 py-2 rounded-lg max-w-[90vw] overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
                setZoom(1);
                setPosition({ x: 0, y: 0 });
              }}
              className={`relative w-16 h-16 shrink-0 rounded overflow-hidden transition-opacity ${
                index === currentIndex
                  ? "ring-2 ring-white opacity-100"
                  : "opacity-50 hover:opacity-75"
              }`}
            >
              <img
                src={image}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

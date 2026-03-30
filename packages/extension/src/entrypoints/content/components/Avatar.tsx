import React, { useCallback } from "react";
import { useDraggable } from "../hooks/useDraggable";

export const AVATAR_SIZES = { small: 48, medium: 72, big: 96 } as const;

interface AvatarProps {
  size: "small" | "medium" | "big";
  iconUrl: string;
  position: { x: number; y: number } | null;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onClick: () => void;
  /** Ref to the wrapper element (used for proximity detection). */
  wrapperRef?: React.RefObject<HTMLDivElement | null>;
}

export function Avatar({
  size,
  iconUrl,
  position,
  onDragEnd,
  onClick,
  wrapperRef,
}: AvatarProps) {
  const px = AVATAR_SIZES[size];
  const {
    position: pos,
    isDragging,
    wasDragged,
    onPointerDown,
  } = useDraggable({
    initialPosition: position,
    size: px,
    onDragEnd,
  });

  const handleClick = useCallback(() => {
    // Only fire click if the pointer wasn't dragged
    if (!wasDragged.current) onClick();
  }, [onClick, wasDragged]);

  return (
    <div
      ref={wrapperRef}
      className="gyozai-avatar-wrapper"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 2147483647,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        userSelect: "none",
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      {/* Avatar image */}
      <button
        className="gyozai-avatar"
        onClick={handleClick}
        style={{
          width: px,
          height: px,
          borderRadius: "50%",
          border: "1px solid var(--g-surface-border)",
          background: "var(--g-surface-1)",
          cursor: isDragging ? "grabbing" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          boxShadow:
            "0 4px 24px rgba(0, 0, 0, 0.35), 0 0 0 0 oklch(0.66 0.18 72 / 0)",
          transition:
            "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease",
        }}
      >
        <img
          src={iconUrl}
          alt="gyoza"
          style={{
            width: px * 0.6,
            height: px * 0.6,
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
      </button>

      {/* Name + drag handle */}
      <div
        className="gyozai-avatar-label"
        onPointerDown={onPointerDown}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          cursor: isDragging ? "grabbing" : "grab",
          fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: 11,
          color: "var(--g-text-secondary)",
          padding: "2px 6px",
          borderRadius: 6,
          background: "oklch(0.13 0.015 50 / 0.8)",
          backdropFilter: "blur(4px)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            background:
              "linear-gradient(135deg, var(--g-brand-400), var(--g-brand-600))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          gyoza
        </span>
        {/* Drag handle icon (grip dots) */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ opacity: 0.5 }}
        >
          <circle cx="9" cy="5" r="1" fill="currentColor" />
          <circle cx="15" cy="5" r="1" fill="currentColor" />
          <circle cx="9" cy="12" r="1" fill="currentColor" />
          <circle cx="15" cy="12" r="1" fill="currentColor" />
          <circle cx="9" cy="19" r="1" fill="currentColor" />
          <circle cx="15" cy="19" r="1" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

import React, { useCallback } from "react";
import { useDraggable } from "../hooks/useDraggable";

export const AVATAR_SIZES = { small: 48, medium: 72, big: 96 } as const;

interface AvatarProps {
  size: "small" | "medium" | "big";
  iconUrl: string;
  /** Animated icon shown when the agent is talking/responding. */
  talkingIconUrl?: string;
  /** Whether the agent is currently talking (shows talking icon + pulse). */
  isTalking?: boolean;
  position: { x: number; y: number } | null;
  onDragEnd: (pos: { x: number; y: number }) => void;
  onClick: () => void;
  /** Ref to the wrapper element (used for proximity detection). */
  wrapperRef?: React.RefObject<HTMLDivElement | null>;
}

export function Avatar({
  size,
  iconUrl,
  talkingIconUrl,
  isTalking = false,
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
      {/* Avatar image — swaps between idle and talking, also draggable */}
      <button
        className={`gyozai-avatar ${isTalking ? "gyozai-avatar-talking" : ""}`}
        onPointerDown={onPointerDown}
        style={{
          width: px,
          height: px,
          borderRadius: "50%",
          border: isTalking
            ? "2px solid var(--g-brand-500)"
            : "1px solid var(--g-surface-border)",
          background: "var(--g-surface-1)",
          cursor: isDragging ? "grabbing" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          boxShadow: isTalking
            ? "0 4px 24px rgba(0, 0, 0, 0.35), 0 0 12px oklch(0.66 0.18 72 / 0.3)"
            : "0 4px 24px rgba(0, 0, 0, 0.35)",
          transition:
            "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border 0.3s ease",
          overflow: "hidden",
        }}
      >
        <img
          src={isTalking && talkingIconUrl ? talkingIconUrl : iconUrl}
          alt="gyoza"
          style={{
            width: isTalking ? px : px * 0.6,
            height: isTalking ? px : px * 0.6,
            borderRadius: "50%",
            pointerEvents: "none",
            transition: "width 0.2s ease, height 0.2s ease",
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
          fontWeight: 800,
          fontSize: 15,
          color: "var(--g-text-secondary)",
          padding: "5px 12px",
          borderRadius: 8,
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
          width="18"
          height="18"
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

import { useState, useRef, useEffect, type CSSProperties } from "react";
import { useEngine, type UseEngineConfig } from "./use-engine";
import { styles, SPINNER_KEYFRAMES } from "./styles";
import { FormatMessage } from "./format-message";

export interface BubbleSearchProps extends UseEngineConfig {
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  placeholder?: string;
}

const POSITION_STYLES: Record<string, CSSProperties> = {
  "bottom-right": { bottom: 20, right: 20 },
  "bottom-left": { bottom: 20, left: 20 },
  "top-right": { top: 20, right: 20 },
  "top-left": { top: 20, left: 20 },
};

const PANEL_POSITION: Record<string, CSSProperties> = {
  "bottom-right": { bottom: 64, right: 0 },
  "bottom-left": { bottom: 64, left: 0 },
  "top-right": { top: 64, right: 0 },
  "top-left": { top: 64, left: 0 },
};

// Simple gyoza SVG icon — matches the logo: round dumpling with cute face
const GyozaIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Dumpling body */}
    <path
      d="M50 15C25 15 8 35 8 55C8 72 24 85 50 85C76 85 92 72 92 55C92 35 75 15 50 15Z"
      stroke="#F5A623"
      strokeWidth="5"
      strokeLinecap="round"
      fill="none"
    />
    {/* Crimped top edge */}
    <path
      d="M22 30C28 20 38 14 50 14C62 14 72 20 78 30"
      stroke="#F5A623"
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
    <path
      d="M18 35C22 28 30 22 38 22C42 24 44 28 48 26C52 24 56 22 62 22C70 22 78 28 82 35"
      stroke="#F5A623"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
    {/* Eyes */}
    <circle cx="38" cy="55" r="5" fill="#F5A623" />
    <circle cx="62" cy="55" r="5" fill="#F5A623" />
    {/* Smile */}
    <path
      d="M40 66C44 72 56 72 60 66"
      stroke="#F5A623"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export function BubbleSearch({
  position = "bottom-right",
  placeholder = "Ask me anything...",
  ...engineConfig
}: BubbleSearchProps) {
  const { messages, loading, error, clarify, query, selectClarifyOption } =
    useEngine(engineConfig);
  const [expanded, setExpanded] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem("gyozai_expanded") === "true";
  });
  const [input, setInput] = useState("");
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const styleInjected = useRef(false);

  // Persist expanded state across navigation
  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("gyozai_expanded", String(expanded));
    }
  }, [expanded]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Inject spinner keyframes once
  useEffect(() => {
    if (styleInjected.current) return;
    const style = document.createElement("style");
    style.textContent = SPINNER_KEYFRAMES;
    document.head.appendChild(style);
    styleInjected.current = true;
  }, []);

  // Auto-focus input when expanded
  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        // Check if click was on the bubble button itself
        const bubble = panelRef.current.parentElement?.querySelector(
          "[data-gyozai-bubble]",
        );
        if (bubble && bubble.contains(target)) return;
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    query(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setExpanded(false);
    }
  };

  const posStyle = POSITION_STYLES[position];
  const panelPosStyle = PANEL_POSITION[position];

  return (
    <div style={{ position: "fixed", zIndex: 9999, ...posStyle }}>
      {/* Bubble button */}
      <button
        data-gyozai-bubble
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...styles.bubble,
          position: "relative" as const,
          ...(hovered ? styles.bubbleHover : {}),
        }}
        aria-label="Open search assistant"
      >
        <GyozaIcon />
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div
          ref={panelRef}
          style={{
            ...styles.panel,
            ...styles.bubblePanel,
            ...panelPosStyle,
          }}
        >
          {/* Input */}
          <div style={styles.inputWrapper}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              style={styles.input}
            />
            {loading && <div style={styles.spinner} />}
          </div>

          {/* Messages */}
          {messages.length > 0 && (
            <div style={styles.messageList}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={
                    msg.role === "user"
                      ? styles.messageUser
                      : styles.messageAssistant
                  }
                >
                  <FormatMessage text={msg.content} />
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Clarify options */}
          {clarify && (
            <div style={styles.clarifyWrapper}>
              <div style={styles.clarifyMessage}>{clarify.message}</div>
              <div style={styles.clarifyOptions}>
                {clarify.options.map((option) => (
                  <ClarifyButton
                    key={option}
                    label={option}
                    onClick={() => selectClarifyOption(option)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && <div style={styles.error}>{error}</div>}
        </div>
      )}
    </div>
  );
}

function ClarifyButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      style={{
        ...styles.clarifyOption,
        ...(hovered ? styles.clarifyOptionHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

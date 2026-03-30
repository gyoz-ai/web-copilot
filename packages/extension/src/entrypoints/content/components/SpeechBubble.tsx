import React, { useEffect, useRef, useState } from "react";
import { TypewriterText } from "./TypewriterText";

interface SpeechBubbleProps {
  /** The text to display. */
  text: string;
  /** Whether this is a "Thinking..." placeholder. */
  isThinking?: boolean;
  /** Auto-dismiss after this many ms of no text change (0 = never). */
  autoDismissMs?: number;
  /** Called when the bubble should be dismissed. */
  onDismiss?: () => void;
  /** Enable typing sound in the typewriter. */
  soundEnabled?: boolean;
  /** Called when typewriter typing state changes. */
  onTypingChange?: (isTyping: boolean) => void;
  /** Whether to animate the text (false = show instantly). */
  typewriterEnabled?: boolean;
}

export function SpeechBubble({
  text,
  isThinking = false,
  autoDismissMs = 0,
  onDismiss,
  soundEnabled = false,
  onTypingChange,
  typewriterEnabled = true,
}: SpeechBubbleProps) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const prevTextRef = useRef(text);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss timer
  useEffect(() => {
    if (autoDismissMs <= 0 || isThinking) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, 300);
    }, autoDismissMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, autoDismissMs, isThinking, onDismiss]);

  // Animate in when text changes
  useEffect(() => {
    if (text !== prevTextRef.current) {
      setExiting(false);
      setVisible(true);
      prevTextRef.current = text;
    }
  }, [text]);

  if (!visible) return null;

  return (
    <div
      className={`gyozai-speech-bubble ${exiting ? "gyozai-speech-exit" : "gyozai-speech-enter"}`}
    >
      <div className="gyozai-speech-content">
        {isThinking ? (
          <span className="gyozai-speech-thinking">
            Thinking
            <span className="gyozai-thinking-dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </span>
        ) : (
          <TypewriterText
            text={text}
            speed={10}
            enabled={typewriterEnabled}
            soundEnabled={soundEnabled && typewriterEnabled}
            onTypingChange={onTypingChange}
          />
        )}
      </div>
    </div>
  );
}

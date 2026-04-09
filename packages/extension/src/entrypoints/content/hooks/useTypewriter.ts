import { useState, useEffect, useRef } from "react";

interface UseTypewriterOptions {
  /** Full text to reveal. */
  text: string;
  /** Milliseconds per character. */
  speed?: number;
  /** Set to false to show full text immediately (skip animation). */
  enabled?: boolean;
}

export function useTypewriter({
  text,
  speed = 25,
  enabled = true,
}: UseTypewriterOptions) {
  const [charIndex, setCharIndex] = useState(enabled ? 0 : text.length);
  const prevTextRef = useRef(text);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // If text changed, reset animation
    if (text !== prevTextRef.current) {
      prevTextRef.current = text;
      if (enabled) {
        setCharIndex(0);
      } else {
        setCharIndex(text.length);
      }
    }
  }, [text, enabled]);

  useEffect(() => {
    if (!enabled) {
      setCharIndex(text.length);
      return;
    }
    if (charIndex >= text.length) return;

    intervalRef.current = setInterval(() => {
      setCharIndex((prev) => {
        if (prev >= text.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, speed, enabled, charIndex]);

  return {
    displayText: text.slice(0, charIndex),
    isTyping: enabled && charIndex < text.length,
    isComplete: charIndex >= text.length,
  };
}

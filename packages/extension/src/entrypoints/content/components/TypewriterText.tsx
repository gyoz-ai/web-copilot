import React, { useEffect } from "react";
import { useTypewriter } from "../hooks/useTypewriter";
import { useTypingSound } from "../hooks/useTypingSound";
import { FormatMessage } from "./FormatMessage";

interface TypewriterTextProps {
  text: string;
  speed?: number;
  enabled?: boolean;
  soundEnabled?: boolean;
  /** Called when typing state changes (true = typing, false = done). */
  onTypingChange?: (isTyping: boolean) => void;
}

export function TypewriterText({
  text,
  speed = 10,
  enabled = true,
  soundEnabled = false,
  onTypingChange,
}: TypewriterTextProps) {
  const { displayText, isTyping } = useTypewriter({ text, speed, enabled });
  useTypingSound(soundEnabled, isTyping);

  useEffect(() => {
    onTypingChange?.(isTyping);
  }, [isTyping, onTypingChange]);

  return <FormatMessage text={displayText} />;
}

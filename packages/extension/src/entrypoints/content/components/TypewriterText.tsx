import React from "react";
import { useTypewriter } from "../hooks/useTypewriter";
import { useTypingSound } from "../hooks/useTypingSound";
import { FormatMessage } from "./FormatMessage";

interface TypewriterTextProps {
  text: string;
  speed?: number;
  enabled?: boolean;
  soundEnabled?: boolean;
}

export function TypewriterText({
  text,
  speed = 25,
  enabled = true,
  soundEnabled = false,
}: TypewriterTextProps) {
  const { displayText, isTyping } = useTypewriter({ text, speed, enabled });
  useTypingSound(soundEnabled, isTyping);

  return <FormatMessage text={displayText} />;
}

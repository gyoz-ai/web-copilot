import { useRef, useEffect } from "react";

/** Synthesize a soft click sound using Web Audio API.
 *  No audio files needed — fully self-contained. */
export function useTypingSound(enabled: boolean, isTyping: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const lastPlayRef = useRef(0);

  useEffect(() => {
    if (!enabled || !isTyping) return;

    // Create AudioContext lazily (browsers require user gesture first,
    // but by the time typing starts the user has already interacted)
    if (!ctxRef.current) {
      try {
        ctxRef.current = new AudioContext();
      } catch {
        return; // AudioContext not available
      }
    }

    const ctx = ctxRef.current;
    const MIN_INTERVAL = 60; // ms between clicks

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastPlayRef.current < MIN_INTERVAL) return;
      lastPlayRef.current = now;

      try {
        // Short oscillator burst — subtle keyboard click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(
          1800 + Math.random() * 400,
          ctx.currentTime,
        );

        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.03);
      } catch {
        // Ignore audio errors silently
      }
    }, 60);

    return () => clearInterval(interval);
  }, [enabled, isTyping]);
}

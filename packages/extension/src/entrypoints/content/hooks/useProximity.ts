import { useRef, useEffect, useCallback } from "react";

interface UseProximityOptions {
  /** Ref to the element to measure distance from. */
  elementRef: React.RefObject<HTMLElement | null>;
  /** Extra radius in px beyond the element's bounding box. */
  radius: number;
  /** Called when cursor enters the proximity zone. */
  onEnter: () => void;
  /** Called when cursor leaves the proximity zone (after delay). */
  onLeave: () => void;
  /** Delay in ms before onLeave fires (prevents flickering). */
  leaveDelay?: number;
  /** Set to true to disable proximity detection. */
  disabled?: boolean;
}

export function useProximity({
  elementRef,
  radius,
  onEnter,
  onLeave,
  leaveDelay = 500,
  disabled = false,
}: UseProximityOptions) {
  const isInsideRef = useRef(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  // Stable callback refs to avoid re-registering listeners
  const onEnterRef = useRef(onEnter);
  const onLeaveRef = useRef(onLeave);
  onEnterRef.current = onEnter;
  onLeaveRef.current = onLeave;

  const cancelLeave = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  /** Mark as "inside" — call this from chatbox mouseenter too. */
  const forceInside = useCallback(() => {
    cancelLeave();
    if (!isInsideRef.current) {
      isInsideRef.current = true;
      onEnterRef.current();
    }
  }, [cancelLeave]);

  /** Start leave timer — call this from chatbox mouseleave too. */
  const startLeave = useCallback(() => {
    cancelLeave();
    leaveTimerRef.current = setTimeout(() => {
      if (isInsideRef.current) {
        isInsideRef.current = false;
        onLeaveRef.current();
      }
    }, leaveDelay);
  }, [cancelLeave, leaveDelay]);

  useEffect(() => {
    if (disabled) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Throttle with RAF
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const el = elementRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        // Expand rect by radius on all sides
        const expanded = {
          left: rect.left - radius,
          top: rect.top - radius,
          right: rect.right + radius,
          bottom: rect.bottom + radius,
        };

        const inside =
          e.clientX >= expanded.left &&
          e.clientX <= expanded.right &&
          e.clientY >= expanded.top &&
          e.clientY <= expanded.bottom;

        if (inside && !isInsideRef.current) {
          cancelLeave();
          isInsideRef.current = true;
          onEnterRef.current();
        } else if (!inside && isInsideRef.current) {
          // Start delayed leave (cursor may be moving to chatbox)
          cancelLeave();
          leaveTimerRef.current = setTimeout(() => {
            if (isInsideRef.current) {
              isInsideRef.current = false;
              onLeaveRef.current();
            }
          }, leaveDelay);
        }
      });
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      cancelLeave();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [elementRef, radius, leaveDelay, disabled, cancelLeave]);

  return { forceInside, startLeave, cancelLeave };
}

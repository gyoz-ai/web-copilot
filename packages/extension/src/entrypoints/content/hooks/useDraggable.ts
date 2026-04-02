import { useState, useRef, useCallback, useEffect } from "react";

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  /** Initial position. If null, defaults to bottom-right corner. */
  initialPosition: Position | null;
  /** Element size in px (used for default position + viewport clamping). */
  size: number;
  /** Called when drag ends with the final position. */
  onDragEnd: (pos: Position) => void;
}

const DRAG_THRESHOLD = 5;

function clampToViewport(pos: Position, size: number): Position {
  const pad = 8;
  return {
    x: Math.max(pad, Math.min(pos.x, window.innerWidth - size - pad)),
    y: Math.max(pad, Math.min(pos.y, window.innerHeight - size - pad)),
  };
}

function defaultPosition(size: number): Position {
  return {
    x: window.innerWidth - size - 60,
    y: window.innerHeight - size - 100,
  };
}

export function useDraggable({
  initialPosition,
  size,
  onDragEnd,
}: UseDraggableOptions) {
  const [position, setPosition] = useState<Position>(
    initialPosition
      ? clampToViewport(initialPosition, size)
      : defaultPosition(size),
  );
  const [isDragging, setIsDragging] = useState(false);

  const startRef = useRef<{
    px: number;
    py: number;
    ox: number;
    oy: number;
  } | null>(null);
  const movedRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Re-clamp on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampToViewport(prev, size));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [size]);

  // Update position if initialPosition changes (e.g. session restore)
  useEffect(() => {
    if (initialPosition) {
      setPosition(clampToViewport(initialPosition, size));
    }
  }, [initialPosition, size]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startRef.current = {
        px: e.clientX,
        py: e.clientY,
        ox: position.x,
        oy: position.y,
      };
      movedRef.current = false;

      // Transparent overlay to capture pointer events over iframes
      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;cursor:grabbing;";
      // Insert into shadow root if available, otherwise document.body
      const root = (e.target as HTMLElement).getRootNode();
      if (root instanceof ShadowRoot) {
        root.appendChild(overlay);
      } else {
        document.body.appendChild(overlay);
      }
      overlayRef.current = overlay;

      const onMove = (ev: PointerEvent) => {
        const start = startRef.current;
        if (!start) return;
        const dx = ev.clientX - start.px;
        const dy = ev.clientY - start.py;
        if (!movedRef.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD)
          return;
        movedRef.current = true;
        setIsDragging(true);
        setPosition(
          clampToViewport({ x: start.ox + dx, y: start.oy + dy }, size),
        );
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        overlayRef.current?.remove();
        overlayRef.current = null;
        setIsDragging(false);
        if (movedRef.current) {
          setPosition((pos) => {
            onDragEnd(pos);
            return pos;
          });
        }
        startRef.current = null;
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [position, size, onDragEnd],
  );

  return { position, isDragging, wasDragged: movedRef, onPointerDown };
}

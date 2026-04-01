import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Auto-rotates through a set of indices, pausing on hover.
 * Returns current index, setter, and mouse event handlers.
 */
export function useAutoRotate(count: number, intervalMs = 1000) {
  const [index, setIndex] = useState(0);
  const hoveredRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!hoveredRef.current) {
        setIndex((i) => (i + 1) % count);
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs]);

  const onMouseEnter = useCallback(() => {
    hoveredRef.current = true;
  }, []);

  const onMouseLeave = useCallback(() => {
    hoveredRef.current = false;
  }, []);

  return { index, setIndex, onMouseEnter, onMouseLeave };
}

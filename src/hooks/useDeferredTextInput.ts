import { useEffect, useRef, useState } from "react";

/**
 * Pre-filter for non-negative numeric inputs: keeps digits and at most one
 * decimal point. Used to avoid `<input type="number">`'s ugly default styling
 * while still rejecting letters and other junk at the keystroke level.
 */
export const numericInputFilter = (raw: string): string => {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
};

/**
 * Decouples a text input's display state from a heavy commit handler so
 * typing stays responsive even when committing the value triggers expensive
 * re-renders (e.g. recomputing optimizer/generator results).
 *
 * - Local state updates on every keystroke (cheap).
 * - `onCommit` fires only on blur or Enter, when the value actually changed.
 * - Escape reverts to the last committed value.
 * - Prop changes (team switch, store reset) sync back to local.
 * - `filter` (optional) sanitizes each keystroke before it reaches local
 *   state — use to reject non-numeric characters without relying on
 *   `<input type="number">`'s ugly browser-default styling. Callers
 *   should keep `filter` strict enough that the parent's `onCommit`
 *   never rejects the value (otherwise the input can stay stuck on a
 *   stale string until the next external prop change).
 */
export function useDeferredTextInput(
  value: string,
  onCommit: (next: string) => void,
  options?: { filter?: (raw: string) => string }
) {
  const [local, setLocal] = useState(value);
  const valueRef = useRef(value);
  const filter = options?.filter;

  useEffect(() => {
    valueRef.current = value;
    setLocal(value);
  }, [value]);

  return {
    value: local,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setLocal(filter ? filter(raw) : raw);
    },
    onBlur: () => {
      if (local !== valueRef.current) onCommit(local);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") e.currentTarget.blur();
      else if (e.key === "Escape") {
        setLocal(valueRef.current);
        e.currentTarget.blur();
      }
    },
  };
}

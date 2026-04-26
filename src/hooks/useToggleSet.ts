import { useCallback, useState } from "react";

export function useToggleSet<T>(initialValues: Iterable<T> = []) {
  const [values, setValues] = useState<Set<T>>(() => new Set(initialValues));

  const toggle = useCallback((value: T) => {
    setValues((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  return [values, toggle, setValues] as const;
}

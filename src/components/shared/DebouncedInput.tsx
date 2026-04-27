import { forwardRef, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type BaseInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "defaultValue" | "onChange" | "value"
>;

export type DebouncedInputProps = BaseInputProps & {
  value: string;
  onValueChange: (value: string) => void;
  delayMs?: number;
  filter?: (raw: string) => string;
};

export const DebouncedInput = forwardRef<HTMLInputElement, DebouncedInputProps>(
  function DebouncedInput(
    {
      value,
      onValueChange,
      delayMs = 350,
      filter,
      onBlur,
      onFocus,
      onKeyDown,
      ...props
    },
    ref
  ) {
    const [draft, setDraft] = useState(value);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const focusedRef = useRef(false);
    const valueRef = useRef(value);
    const draftRef = useRef(value);
    const onValueChangeRef = useRef(onValueChange);

    useEffect(() => {
      onValueChangeRef.current = onValueChange;
    }, [onValueChange]);

    useEffect(() => {
      valueRef.current = value;
      if (!focusedRef.current) {
        draftRef.current = value;
        setDraft(value);
      }
    }, [value]);

    useEffect(
      () => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      },
      []
    );

    const commit = (next: string) => {
      if (next !== valueRef.current) onValueChangeRef.current(next);
    };

    const scheduleCommit = (next: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        commit(next);
      }, delayMs);
    };

    return (
      <Input
        {...props}
        ref={ref}
        value={draft}
        onFocus={(e) => {
          focusedRef.current = true;
          onFocus?.(e);
        }}
        onChange={(e) => {
          const next = filter ? filter(e.target.value) : e.target.value;
          draftRef.current = next;
          setDraft(next);
          scheduleCommit(next);
        }}
        onBlur={(e) => {
          focusedRef.current = false;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          commit(draftRef.current);
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            draftRef.current = valueRef.current;
            setDraft(valueRef.current);
            e.currentTarget.blur();
          }
          onKeyDown?.(e);
        }}
      />
    );
  }
);

DebouncedInput.displayName = "DebouncedInput";

export type DebouncedNumberInputProps = BaseInputProps & {
  value: number;
  onValueChange: (value: number) => void;
  delayMs?: number;
  min?: number;
  max?: number;
  invalidFallback?: number;
};

function sanitizeInteger(raw: string): string {
  const cleaned = raw.replace(/[^0-9-]/g, "");
  return cleaned.startsWith("-")
    ? `-${cleaned.slice(1).replace(/-/g, "")}`
    : cleaned.replace(/-/g, "");
}

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

export const DebouncedNumberInput = forwardRef<
  HTMLInputElement,
  DebouncedNumberInputProps
>(function DebouncedNumberInput(
  {
    value,
    onValueChange,
    delayMs = 350,
    min,
    max,
    invalidFallback = 0,
    onBlur,
    onFocus,
    onKeyDown,
    ...props
  },
  ref
) {
  const [draft, setDraft] = useState(String(value));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedRef = useRef(false);
  const valueRef = useRef(value);
  const draftRef = useRef(String(value));
  const onValueChangeRef = useRef(onValueChange);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    valueRef.current = value;
    if (!focusedRef.current) {
      const next = String(value);
      draftRef.current = next;
      setDraft(next);
    }
  }, [value]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const commit = (nextDraft: string, fallbackInvalid: boolean) => {
    if (nextDraft === "" || nextDraft === "-") {
      if (!fallbackInvalid) return;
      const fallback = clamp(invalidFallback, min, max);
      draftRef.current = String(fallback);
      setDraft(String(fallback));
      if (fallback !== valueRef.current) onValueChangeRef.current(fallback);
      return;
    }

    const parsed = Number.parseInt(nextDraft, 10);
    if (Number.isNaN(parsed)) return;
    const next = clamp(parsed, min, max);
    if (String(next) !== nextDraft) {
      draftRef.current = String(next);
      setDraft(String(next));
    }
    if (next !== valueRef.current) onValueChangeRef.current(next);
  };

  const scheduleCommit = (next: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      commit(next, false);
    }, delayMs);
  };

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={draft}
      onFocus={(e) => {
        focusedRef.current = true;
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = sanitizeInteger(e.target.value);
        draftRef.current = next;
        setDraft(next);
        scheduleCommit(next);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        commit(draftRef.current, true);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          const current = String(valueRef.current);
          draftRef.current = current;
          setDraft(current);
          e.currentTarget.blur();
        }
        onKeyDown?.(e);
      }}
    />
  );
});

DebouncedNumberInput.displayName = "DebouncedNumberInput";

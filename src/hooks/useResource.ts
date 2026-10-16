import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Language } from "@/domain/enums";
import type { LangResource, Resource } from "@/domain/models";
export function useResource<T>(
  resource: Resource<T>,
  language?: undefined,
  enabled?: boolean
): T | null;
export function useResource<T>(
  resource: LangResource<T>,
  language: Language,
  enabled?: boolean
): T | null;
export function useResource<T>(
  resource: Resource<T> | LangResource<T>,
  language?: Language,
  enabled = true
): T | null {
  const [, force] = useState(0);
  const [failure, setFailure] = useState<{
    resource: typeof resource;
    language: typeof language;
    error: unknown;
  } | null>(null);
  const peek = useCallback(
    () =>
      language === undefined
        ? (resource as Resource<T>).peek()
        : (resource as LangResource<T>).peek(language),
    [resource, language]
  );
  const subscribe = useCallback(
    (listener: () => void) => resource.subscribe?.(listener) ?? (() => {}),
    [resource]
  );
  const data = useSyncExternalStore(subscribe, peek, peek);
  useEffect(() => {
    if (!enabled || peek() !== null) return;
    let cancelled = false;
    const load =
      language === undefined
        ? (resource as Resource<T>).preload()
        : (resource as LangResource<T>).preload(language);
    load.then(
      () => {
        if (!cancelled) force((n) => n + 1);
      },
      (error: unknown) => {
        if (!cancelled) setFailure({ resource, language, error });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [resource, language, peek, enabled]);
  if (
    enabled &&
    failure?.resource === resource &&
    failure.language === language
  )
    throw failure.error;
  return data;
}

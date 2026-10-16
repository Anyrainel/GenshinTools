import type { Language } from "../../domain/enums";
import type { LangResource, Resource } from "../../domain/models";

/**
 * Build a singleton ``Resource<T>`` from an async loader. The loader is
 * invoked at most once; concurrent ``preload()`` calls share the in-flight
 * promise, and the resolved value is cached for synchronous ``peek()``.
 *
 * React consumers subscribe with the separate useResource hook.
 *
 * Note: web workers each have their own JS heap, so a resource constructed in
 * main-thread code is invisible to workers. Each worker must build (or
 * preload) its own copy.
 */
export function makeResource<T>(loader: () => Promise<T>): Resource<T> {
  let cache: T | null = null;
  let pending: Promise<T> | null = null;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const preload = (): Promise<T> => {
    if (cache !== null) return Promise.resolve(cache);
    if (!pending) {
      pending = Promise.resolve()
        .then(loader)
        .then(
          (v) => {
            cache = v;
            for (const listener of listeners) listener();
            pending = null;
            return v;
          },
          (error: unknown) => {
            pending = null;
            throw error;
          }
        );
    }
    return pending;
  };

  const peek = (): T | null => cache;

  return { preload, peek, subscribe };
}

/**
 * Per-language variant of ``makeResource``. The loader is invoked at most
 * once per ``Language``; cache and in-flight promise are both keyed by
 * language so switching language triggers a fresh load while leaving the
 * previous language's cache intact.
 *
 * The same ``preload`` / ``peek`` API as ``makeResource`` applies,
 * with each method taking a ``lang`` argument.
 */
export function makeLangResource<T>(
  loader: (lang: Language) => Promise<T>
): LangResource<T> {
  const cache = new Map<Language, T>();
  const pending = new Map<Language, Promise<T>>();
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const preload = (lang: Language): Promise<T> => {
    const cached = cache.get(lang);
    if (cached !== undefined) return Promise.resolve(cached);
    let promise = pending.get(lang);
    if (!promise) {
      promise = Promise.resolve()
        .then(() => loader(lang))
        .then(
          (v) => {
            cache.set(lang, v);
            for (const listener of listeners) listener();
            pending.delete(lang);
            return v;
          },
          (error: unknown) => {
            pending.delete(lang);
            throw error;
          }
        );
      pending.set(lang, promise);
    }
    return promise;
  };

  const peek = (lang: Language): T | null => cache.get(lang) ?? null;

  return { preload, peek, subscribe };
}

/**
 * Wrap a released-data loader and an optional beta-data loader into a single
 * loader. The result merges beta-only entries underneath the released data
 * (``{ ...beta, ...released }``), so released values always win on key
 * collision and beta-only entries become available alongside them.
 *
 * The beta loader is only invoked when ``betaEnabledNow()`` returns ``true``
 * at call time — this keeps the beta files' presence undetectable from
 * network traffic when the user has not opted into beta. Beta fetch errors
 * are swallowed (treated as an empty bundle) so a missing or broken beta
 * asset never blocks the released data.
 */
export function withBetaOverlay<T extends Record<string, unknown>>(
  loadReleased: () => Promise<T>,
  loadBeta: (() => Promise<T>) | undefined,
  betaEnabledNow: () => boolean
): () => Promise<T> {
  return async () => {
    if (!loadBeta || !betaEnabledNow()) return loadReleased();
    let beta: T;
    try {
      beta = await loadBeta();
    } catch {
      beta = {} as T;
    }
    const released = await loadReleased();
    return { ...beta, ...released };
  };
}

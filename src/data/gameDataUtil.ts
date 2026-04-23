import { useEffect, useState } from "react";
import type { Language } from "./enums";
import type { LangResource, Resource } from "./types";

/**
 * Build a singleton ``Resource<T>`` from an async loader. The loader is
 * invoked at most once; concurrent ``preload()`` calls share the in-flight
 * promise, and the resolved value is cached for synchronous ``peek()``.
 *
 * ``use()`` is a React hook that returns the cached value or ``null`` until
 * the load completes, then re-renders the calling component.
 *
 * Note: web workers each have their own JS heap, so a resource constructed in
 * main-thread code is invisible to workers. Each worker must build (or
 * preload) its own copy.
 */
export function makeResource<T>(loader: () => Promise<T>): Resource<T> {
  let cache: T | null = null;
  let pending: Promise<T> | null = null;

  const preload = (): Promise<T> => {
    if (cache !== null) return Promise.resolve(cache);
    if (!pending) {
      pending = loader().then((v) => {
        cache = v;
        pending = null;
        return v;
      });
    }
    return pending;
  };

  const peek = (): T | null => cache;

  const use = (): T | null => {
    const [, force] = useState(0);
    useEffect(() => {
      if (cache !== null) return;
      let cancelled = false;
      preload().then(() => {
        if (!cancelled) force((n) => n + 1);
      });
      return () => {
        cancelled = true;
      };
    }, []);
    return cache;
  };

  return { preload, use, peek };
}

/**
 * Per-language variant of ``makeResource``. The loader is invoked at most
 * once per ``Language``; cache and in-flight promise are both keyed by
 * language so switching language triggers a fresh load while leaving the
 * previous language's cache intact.
 *
 * The same ``preload`` / ``use`` / ``peek`` API as ``makeResource`` applies,
 * with each method taking a ``lang`` argument.
 */
export function makeLangResource<T>(
  loader: (lang: Language) => Promise<T>
): LangResource<T> {
  const cache = new Map<Language, T>();
  const pending = new Map<Language, Promise<T>>();

  const preload = (lang: Language): Promise<T> => {
    const cached = cache.get(lang);
    if (cached !== undefined) return Promise.resolve(cached);
    let promise = pending.get(lang);
    if (!promise) {
      promise = loader(lang).then((v) => {
        cache.set(lang, v);
        pending.delete(lang);
        return v;
      });
      pending.set(lang, promise);
    }
    return promise;
  };

  const peek = (lang: Language): T | null => cache.get(lang) ?? null;

  const use = (lang: Language): T | null => {
    const [, force] = useState(0);
    useEffect(() => {
      if (cache.has(lang)) return;
      let cancelled = false;
      preload(lang).then(() => {
        if (!cancelled) force((n) => n + 1);
      });
      return () => {
        cancelled = true;
      };
    }, [lang]);
    return cache.get(lang) ?? null;
  };

  return { preload, use, peek };
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
    const [released, beta] = await Promise.all([
      loadReleased(),
      loadBeta().catch(() => ({}) as T),
    ]);
    return { ...beta, ...released };
  };
}

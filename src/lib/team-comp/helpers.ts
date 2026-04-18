import type { BuffSource } from "./types";

/** Canonical key for a BuffSource, used in BuffActivationMap and override store. */
export function buffSourceKey(source: BuffSource): string {
  const base = `${source.type}:${source.id}:${source.origin ?? ""}`;
  return source.internalKey ? `${base}:${source.internalKey}` : base;
}

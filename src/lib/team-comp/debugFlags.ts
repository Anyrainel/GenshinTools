/**
 * Debug flags consulted by the team-comp damage pipeline.
 * Read once at module load so call sites can use a plain boolean.
 * Browser builds have no `process` global; guard via `globalThis`.
 */
const g = globalThis as {
  process?: { env?: Record<string, string | undefined> };
};
export const DEBUG_CROSSPATH = !!g.process?.env?.DEBUG_CROSSPATH;

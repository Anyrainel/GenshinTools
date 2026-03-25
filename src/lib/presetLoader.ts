import type { PresetOption } from "@/data/types";

/**
 * Loads preset metadata from a glob pattern of preset modules
 * @param presetModules - Glob pattern result from import.meta.glob
 * @returns Array of preset options with metadata
 */
// Cache preset metadata per modules-ref so multiple pages don't bust each other's cache
const metadataCache = new Map<unknown, PresetOption[]>();

/** Synchronously return cached metadata for a given modules object, or null if not yet loaded. */
export function getCachedPresetMetadata(
  modules: unknown
): PresetOption[] | null {
  return metadataCache.get(modules) ?? null;
}

export async function loadPresetMetadata<
  T extends { author?: string; description?: string },
>(
  presetModules: Record<string, () => Promise<{ default: T }>>
): Promise<PresetOption[]> {
  const cached = metadataCache.get(presetModules);
  if (cached) return cached;

  const options = await Promise.all(
    Object.keys(presetModules).map(async (path) => {
      try {
        const loader = presetModules[path];
        const module = await loader();
        const payload = module.default;

        // Use author and description if available, otherwise fallback to filename
        if (payload.author && payload.description) {
          return {
            path,
            label: `[${payload.author}] ${payload.description}`,
            author: payload.author,
            description: payload.description,
          };
        }
        const fileName = path.split("/").pop() || path;
        const label = fileName.replace(/\.json$/i, "").replace(/[-_]+/g, " ");
        return { path, label: label.trim() || fileName };
      } catch (error) {
        console.error(`Failed to load preset metadata for ${path}:`, error);
        const fileName = path.split("/").pop() || path;
        const label = fileName.replace(/\.json$/i, "").replace(/[-_]+/g, " ");
        return { path, label: label.trim() || fileName };
      }
    })
  );

  const sorted = options.sort((a, b) => a.label.localeCompare(b.label));
  metadataCache.set(presetModules, sorted);
  return sorted;
}

/**
 * Loads a preset payload by path
 * @param presetModules - Glob pattern result from import.meta.glob
 * @param path - Path to the preset module
 * @returns The preset payload
 * @throws Error if preset not found
 */
export async function loadPresetPayload<T>(
  presetModules: Record<string, () => Promise<{ default: T }>>,
  path: string
): Promise<T> {
  const loader = presetModules[path];
  if (!loader) {
    throw new Error(`Preset not found for path: ${path}`);
  }

  const module = await loader();
  return module.default;
}

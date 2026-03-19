import type { PresetOption } from "@/data/types";

/**
 * Loads preset metadata from a glob pattern of preset modules
 * @param presetModules - Glob pattern result from import.meta.glob
 * @returns Array of preset options with metadata
 */
// Cache preset metadata to avoid re-loading on every page mount
let cachedMetadata: PresetOption[] | null = null;
let cachedModulesRef: unknown = null;

export async function loadPresetMetadata<
  T extends { author?: string; description?: string },
>(
  presetModules: Record<string, () => Promise<{ default: T }>>
): Promise<PresetOption[]> {
  // Return cached result if same modules object
  if (cachedMetadata && cachedModulesRef === presetModules) {
    return cachedMetadata;
  }
  cachedModulesRef = presetModules;

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

  cachedMetadata = options.sort((a, b) => a.label.localeCompare(b.label));
  return cachedMetadata;
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

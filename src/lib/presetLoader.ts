import { PresetOption } from '@/data/types';

/**
 * Loads preset metadata from a glob pattern of preset modules
 * @param presetModules - Glob pattern result from import.meta.glob
 * @returns Array of preset options with metadata
 */
export async function loadPresetMetadata<T extends { author?: string; description?: string }>(
  presetModules: Record<string, () => Promise<{ default: T } | T>>
): Promise<PresetOption[]> {
  const options = await Promise.all(
    Object.keys(presetModules).map(async (path) => {
      try {
        const loader = presetModules[path];
        const module = await loader();
        const payload = (module && typeof module === 'object' && 'default' in module)
          ? (module as { default: T }).default
          : (module as unknown as T);

        // Use author and description if available, otherwise fallback to filename
        if (payload.author && payload.description) {
          return {
            path,
            label: `[${payload.author}] ${payload.description}`,
            author: payload.author,
            description: payload.description
          };
        } else {
          const fileName = path.split('/').pop() || path;
          const label = fileName.replace(/\.json$/i, '').replace(/[-_]+/g, ' ');
          return { path, label: label.trim() || fileName };
        }
      } catch (error) {
        console.error(`Failed to load preset metadata for ${path}:`, error);
        const fileName = path.split('/').pop() || path;
        const label = fileName.replace(/\.json$/i, '').replace(/[-_]+/g, ' ');
        return { path, label: label.trim() || fileName };
      }
    })
  );

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Loads a preset payload by path
 * @param presetModules - Glob pattern result from import.meta.glob
 * @param path - Path to the preset module
 * @returns The preset payload
 * @throws Error if preset not found
 */
export async function loadPresetPayload<T>(
  presetModules: Record<string, () => Promise<{ default: T } | T>>,
  path: string
): Promise<T> {
  const loader = presetModules[path];
  if (!loader) {
    throw new Error(`Preset not found for path: ${path}`);
  }

  const module = await loader();
  if (module && typeof module === 'object' && 'default' in module) {
    return (module as { default: T }).default;
  }
  return module as unknown as T;
}


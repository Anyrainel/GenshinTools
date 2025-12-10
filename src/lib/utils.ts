import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the full URL for an asset path
 * Prepends the Vite base URL for proper asset loading
 */
export function getAssetUrl(path: string): string {
  const BASE_URL = import.meta.env.BASE_URL || "/";

  // If path already starts with BASE_URL, return as-is
  if (path.startsWith(BASE_URL)) {
    return path;
  }

  // If path starts with /, prepend BASE_URL (removing trailing slash if needed)
  if (path.startsWith("/")) {
    const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
    return base + path;
  }

  // Otherwise, just prepend BASE_URL
  return BASE_URL + path;
}

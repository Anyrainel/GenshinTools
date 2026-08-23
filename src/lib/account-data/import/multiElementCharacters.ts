import { charNameMap, normalizeEntityName } from "./entityMaps";

export const DEFAULT_MULTI_ELEMENT_CHARACTER_ELEMENT = "Cryo";

export const MULTI_ELEMENT_CHARACTER_NAMES = new Set([
  "Traveler",
  "Manekin",
  "Manekina",
]);

export function normalizeElementName(element: string): string {
  return element.charAt(0).toUpperCase() + element.slice(1).toLowerCase();
}

export function resolveMultiElementCharacterKey(
  name: string,
  element?: string
): string | undefined {
  if (!MULTI_ELEMENT_CHARACTER_NAMES.has(name)) return undefined;

  const normalizedElement = element
    ? normalizeElementName(element)
    : DEFAULT_MULTI_ELEMENT_CHARACTER_ELEMENT;
  const requestedKey = charNameMap.get(
    normalizeEntityName(`${name} (${normalizedElement})`)
  );
  if (requestedKey) return requestedKey;

  return charNameMap.get(
    normalizeEntityName(`${name} (${DEFAULT_MULTI_ELEMENT_CHARACTER_ELEMENT})`)
  );
}
